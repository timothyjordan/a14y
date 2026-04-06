import { crawlSite, type DiscoveredPage, type DiscoverySource } from '../crawler';
import { collectSeeds } from '../crawler/sources';
import { DISCOVERY_INDEXED_KEY } from '../checks/page/discovery';
import { createHttpClient } from '../fetch/httpClient';
import type { HttpClient } from '../fetch/types';
import { getScorecard, LATEST_SCORECARD } from '../scorecard';
import type {
  ResolvedCheck,
  ResolvedScorecard,
  SiteCheckContext,
} from '../scorecard/types';
import { summarize, type CheckResult, type ScoreSummary } from '../score/compute';
import { runPage } from './runPage';

export type RunMode = 'page' | 'site';

export interface RunOptions {
  /** URL to audit. For site mode, the site origin is derived from this URL. */
  url: string;
  mode?: RunMode;
  /** Scorecard version to evaluate against. Defaults to the latest. */
  scorecardVersion?: string;
  http?: HttpClient;
  maxPages?: number;
  concurrency?: number;
  politeDelayMs?: number;
  onProgress?: (event: ProgressEvent) => void;
}

export type ProgressEvent =
  | { type: 'started'; mode: RunMode; url: string; scorecardVersion: string }
  | { type: 'site-check-done'; result: CheckResult }
  | { type: 'page-discovered'; url: string; visited: number }
  | { type: 'page-done'; url: string; passed: number; total: number }
  | { type: 'finished'; summary: ScoreSummary };

export interface PageReport {
  url: string;
  finalUrl: string;
  status: number;
  sources: DiscoverySource[];
  checks: CheckResult[];
  summary: ScoreSummary;
}

export interface SiteRun {
  url: string;
  baseUrl: string;
  mode: RunMode;
  scorecardVersion: string;
  scorecardReleasedAt: string;
  startedAt: string;
  finishedAt: string;
  siteChecks: CheckResult[];
  pages: PageReport[];
  /** Aggregate score across site checks plus every page check on every page. */
  summary: ScoreSummary;
}

/**
 * Top-level entrypoint shared by the CLI and the extension. In page mode it
 * fetches the single URL and runs page-level checks against it; in site mode
 * it crawls the entire origin via the crawler and runs page checks across
 * every discovered page. Site-level checks always run once per audit so the
 * llms.txt / sitemap / AGENTS.md story is reflected in both modes.
 */
export async function validate(opts: RunOptions): Promise<SiteRun> {
  const mode: RunMode = opts.mode ?? 'page';
  const scorecardVersion = opts.scorecardVersion ?? LATEST_SCORECARD;
  const scorecard = getScorecard(scorecardVersion);
  const http = opts.http ?? createHttpClient();
  const baseUrl = new URL(opts.url).origin + '/';
  const shared = new Map<string, unknown>();
  const startedAt = new Date().toISOString();

  opts.onProgress?.({ type: 'started', mode, url: opts.url, scorecardVersion });

  const siteCtx: SiteCheckContext = {
    scope: 'site',
    baseUrl,
    http,
    shared,
  };

  // Discover seeds first so site-level resources are cached and the
  // discovery.indexed page check has the announced URL set available.
  let pageInputs: DiscoveredPage[] = [];
  if (mode === 'site') {
    const seeds = await collectSeeds(siteCtx);
    shared.set(DISCOVERY_INDEXED_KEY, seeds.urls);

    const collected: DiscoveredPage[] = [];
    for await (const page of crawlSite({
      baseUrl,
      http,
      siteCtx,
      maxPages: opts.maxPages,
      concurrency: opts.concurrency,
      politeDelayMs: opts.politeDelayMs,
    })) {
      collected.push(page);
      opts.onProgress?.({
        type: 'page-discovered',
        url: page.url,
        visited: collected.length,
      });
    }
    pageInputs = collected;
  } else {
    // Single-page mode: still call collectSeeds so any cached resources are
    // available to checks, but don't publish DISCOVERY_INDEXED_KEY (the
    // discovery.indexed check returns na in that case).
    await collectSeeds(siteCtx);
    const fetched = await http.fetchPage(opts.url);
    pageInputs = [
      { url: fetched.url, page: fetched, sources: new Set(['crawl']) },
    ];
  }

  // Run site checks once per audit. Each check is independent, so fan them
  // out in parallel.
  const siteChecks = await Promise.all(
    scorecard.siteChecks.map((c) => runSiteCheck(c, siteCtx)),
  );
  for (const r of siteChecks) opts.onProgress?.({ type: 'site-check-done', result: r });

  // Run page checks for every discovered page in parallel. Each page run
  // already fans out its own checks internally; we then summarize each.
  const pages: PageReport[] = await Promise.all(
    pageInputs.map(async (input) => {
      const pageRun = await runPage({
        scorecard,
        http,
        baseUrl,
        shared,
        page: input.page,
      });
      const summary = summarize(pageRun.checks);
      opts.onProgress?.({
        type: 'page-done',
        url: pageRun.finalUrl,
        passed: summary.passed,
        total: summary.total,
      });
      return {
        url: pageRun.url,
        finalUrl: pageRun.finalUrl,
        status: pageRun.status,
        sources: [...input.sources],
        checks: pageRun.checks,
        summary,
      };
    }),
  );

  // Aggregate every check (site + all pages) into the run-wide score.
  const allChecks: CheckResult[] = [
    ...siteChecks,
    ...pages.flatMap((p) => p.checks),
  ];
  const summary = summarize(allChecks);
  const finishedAt = new Date().toISOString();

  opts.onProgress?.({ type: 'finished', summary });

  return {
    url: opts.url,
    baseUrl,
    mode,
    scorecardVersion: scorecard.version,
    scorecardReleasedAt: scorecard.releasedAt,
    startedAt,
    finishedAt,
    siteChecks,
    pages,
    summary,
  };
}

async function runSiteCheck(check: ResolvedCheck, ctx: SiteCheckContext): Promise<CheckResult> {
  try {
    const outcome = await check.run(ctx);
    return {
      id: check.id,
      name: check.name,
      group: check.group,
      scope: 'site',
      implementationVersion: check.implementationVersion,
      status: outcome.status,
      message: outcome.message,
      details: outcome.details,
    };
  } catch (e) {
    return {
      id: check.id,
      name: check.name,
      group: check.group,
      scope: 'site',
      implementationVersion: check.implementationVersion,
      status: 'error',
      message: (e as Error).message,
    };
  }
}

// Re-export for ergonomic single import.
export { type ResolvedScorecard };
