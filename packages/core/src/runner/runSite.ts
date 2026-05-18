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
  ScoringMethodology,
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
   * Page-level check fan-out concurrency. Bounds how many pages have
   * their checks running at once. Combined with the producer-side
   * backpressure gate at `waitForSlot(pageCheckConcurrency + 1)`, this
   * is what actually bounds peak memory: the consumer never lets more
   * than `pageCheckConcurrency + 1` pages sit in the check queue, and
   * the crawler buffer caps another `concurrency` (default 8) on top.
   * Default 4 keeps peak heap small on every shape of site we audit.
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
  /**
   * The scorecard-pinned aggregation algorithm that produced `summary.score`.
   * Consumers (leaderboards, dashboards) read this to know which historical
   * scoring contract this SiteRun honors; it is part of the immutability
   * promise alongside `scorecardVersion`.
   */
  scoringMethodology: ScoringMethodology;
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
  // `https://a14y.dev/`. Empty for sites at
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

  // Page checks stream directly from the crawler into a bounded queue.
  // Two backpressure seams keep peak memory a small constant of the
  // crawl size:
  //   (a) the crawler's internal hand-off buffer is capped at
  //       `concurrency` (default 8) — fetch workers park when full
  //       rather than piling completed pages into memory.
  //   (b) the for-await consumer below awaits `waitForSlot` before
  //       enqueueing each new handlePage task, so this queue's
  //       `pending` array never grows past `pageCheckConcurrency + 1`.
  // Without both, an unbounded `pending` here was OOM'ing the CLI at
  // ~384 pages on doc sites whose pages were a few MB each.
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
      // Per-page summaries always use flat-pool semantics regardless of the
      // site-level scoringMethodology: the per-page score is "how many of this
      // page's applicable checks passed," which is a different question from
      // the site's aggregate score. Methodology only affects the site summary
      // below.
      const summary = summarize(pageRun.checks, 'flat-pool-v1');
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
      // Backpressure gate: don't queue another page-check until there
      // is room for it. `+ 1` keeps workers fed across the runPage
      // await boundary without doubling the in-flight page set.
      await pageCheckQueue.waitForSlot(pageCheckConcurrency + 1);
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

  // Aggregate every check (site + all pages) into the run-wide score under
  // the scorecard's pinned scoring methodology.
  const allChecks: CheckResult[] = [
    ...siteChecks,
    ...pages.flatMap((p) => p.checks),
  ];
  const summary = summarize(allChecks, scorecard.scoringMethodology);
  const finishedAt = new Date().toISOString();

  opts.onProgress?.({ type: 'finished', summary });

  return {
    url: opts.url,
    baseUrl,
    mode,
    scorecardVersion: scorecard.version,
    scorecardReleasedAt: scorecard.releasedAt,
    scoringMethodology: scorecard.scoringMethodology,
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
