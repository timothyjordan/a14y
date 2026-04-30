import { crawlSite, type DiscoveredPage, type DiscoverySource } from '../crawler';
import { ConcurrentQueue } from '../crawler/queue';
import { collectSeeds } from '../crawler/sources';
import { DISCOVERY_INDEXED_KEY } from '../checks/page/discovery';
import { createHttpClient } from '../fetch/httpClient';
import type { HttpClient } from '../fetch/types';
import { getScorecard, LATEST_SCORECARD } from '../scorecard';
import { buildCheckDocsUrl } from '../scorecard/docsUrl';
import type {
  ResolvedCheck,
  ResolvedScorecard,
  SeedProgressEvent,
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
  /** Crawler fetch concurrency (page discovery). */
  concurrency?: number;
  politeDelayMs?: number;
  /**
   * Page-level check fan-out concurrency. Bounds how many pages have their
   * checks running at once, which is what bounds peak memory: each in-flight
   * page holds its cheerio DOM tree until its checks finish. Default 4 keeps
   * peak heap well under typical renderer caps even on large doc sites.
   */
  pageCheckConcurrency?: number;
  onProgress?: (event: ProgressEvent) => void;
}

export type ProgressEvent =
  | { type: 'started'; mode: RunMode; url: string; scorecardVersion: string }
  | { type: 'seed-progress'; event: SeedProgressEvent }
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
  const parsedInput = new URL(opts.url);
  const baseUrl = parsedInput.origin + '/';
  // Pathname prefix the site is hosted under, e.g. `/a14y` for
  // `https://timothyjordan.github.io/a14y/`. Empty for sites at
  // the origin root. Trailing slash stripped so loaders can join it
  // cleanly with leading-slash well-known paths.
  const sitePrefix = parsedInput.pathname.replace(/\/$/, '');
  const shared = new Map<string, unknown>();
  const startedAt = new Date().toISOString();

  opts.onProgress?.({ type: 'started', mode, url: opts.url, scorecardVersion });

  const siteCtx: SiteCheckContext = {
    scope: 'site',
    baseUrl,
    http,
    shared,
    sitePrefix,
    // Forward seed-loading progress into the unified onProgress stream so
    // the CLI spinner can render movement during long sitemap-index reads.
    onSeedProgress: opts.onProgress
      ? (event) => opts.onProgress!({ type: 'seed-progress', event })
      : undefined,
  };

  // Site checks fan out independently of page checks. Kick them off in
  // parallel with page processing so they're ready by the time the crawl
  // finishes.
  const siteChecksPromise = Promise.all(
    scorecard.siteChecks.map((c) => runSiteCheck(c, siteCtx, scorecard.version)),
  );

  // Page checks now stream directly from the crawler into a bounded
  // queue. The previous implementation buffered every DiscoveredPage
  // (each holding a cheerio DOM tree) in an array first, then fanned
  // every check out simultaneously — that meant peak memory grew
  // linearly with the page count and OOM'd the offscreen renderer at
  // ~300 doc pages. Streaming caps peak memory at
  // pageCheckConcurrency × pageSize (default 4 × ~5MB ≈ 20MB) instead.
  const pageCheckConcurrency = opts.pageCheckConcurrency ?? 4;
  const pageCheckQueue = new ConcurrentQueue({ concurrency: pageCheckConcurrency });
  const pages: PageReport[] = [];

  const handlePage = (input: DiscoveredPage): Promise<void> =>
    pageCheckQueue.add(async () => {
      const pageRun = await runPage({
        scorecard,
        http,
        baseUrl,
        shared,
        page: input.page,
      });
      const summary = summarize(pageRun.checks);
      pages.push({
        url: pageRun.url,
        finalUrl: pageRun.finalUrl,
        status: pageRun.status,
        sources: [...input.sources],
        checks: pageRun.checks,
        summary,
      });
      opts.onProgress?.({
        type: 'page-done',
        url: pageRun.finalUrl,
        passed: summary.passed,
        total: summary.total,
      });

      // Release the FetchedPage so cheerio + the body string can be
      // garbage-collected before the next page's checks claim a slot.
      // Also drop this page's per-page cache entries from the shared
      // map (jsonLd parse + markdown mirror body) — they're only ever
      // used by the checks for this same URL.
      (input as { page: unknown }).page = null;
      shared.delete(`page:json-ld:${pageRun.finalUrl}`);
      shared.delete(`page:md-mirror:${pageRun.finalUrl}`);
    });

  if (mode === 'site') {
    const seeds = await collectSeeds(siteCtx);
    shared.set(DISCOVERY_INDEXED_KEY, seeds.urls);

    let visited = 0;
    for await (const page of crawlSite({
      baseUrl,
      http,
      siteCtx,
      // Seed the crawl from the user-provided URL so subpath-hosted
      // sites (`https://host/docs/`) actually start at /docs/ instead
      // of bouncing off the origin root.
      entryUrl: opts.url,
      maxPages: opts.maxPages,
      concurrency: opts.concurrency,
      politeDelayMs: opts.politeDelayMs,
    })) {
      visited++;
      opts.onProgress?.({
        type: 'page-discovered',
        url: page.url,
        visited,
      });
      void handlePage(page);
    }
    await pageCheckQueue.onIdle();
  } else {
    // Single-page mode: still call collectSeeds so any cached resources are
    // available to checks, but don't publish DISCOVERY_INDEXED_KEY (the
    // discovery.indexed check returns na in that case).
    await collectSeeds(siteCtx);
    const fetched = await http.fetchPage(opts.url);
    await handlePage({
      url: fetched.url,
      page: fetched,
      sources: new Set(['crawl']),
    });
    await pageCheckQueue.onIdle();
  }

  const siteChecks = await siteChecksPromise;
  for (const r of siteChecks) opts.onProgress?.({ type: 'site-check-done', result: r });

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

async function runSiteCheck(
  check: ResolvedCheck,
  ctx: SiteCheckContext,
  scorecardVersion: string,
): Promise<CheckResult> {
  const docsUrl = buildCheckDocsUrl(scorecardVersion, check.id);
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
      docsUrl,
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
      docsUrl,
    };
  }
}

// Re-export for ergonomic single import.
export { type ResolvedScorecard };
