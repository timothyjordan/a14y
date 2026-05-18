import { crawlSite, type DiscoveredPage, type DiscoverySource } from '../crawler';
import { ConcurrentQueue } from '../crawler/queue';
import { collectSeeds } from '../crawler/sources';
import { DISCOVERY_INDEXED_KEY } from '../checks/page/discovery';
import { createHttpClient } from '../fetch/httpClient';
import type { HttpClient } from '../fetch/types';
import { getScorecard, LATEST_SCORECARD } from '../scorecard';
import { buildCheckDocsUrl } from '../scorecard/docsUrl';
import type {
  CheckOutcome,
  PageCheckContext,
  ResolvedCheck,
  ResolvedScorecard,
  ScoringMethodology,
  SeedProgressEvent,
  SiteCheckContext,
} from '../scorecard/types';
import { summarize, type CheckResult, type ScoreSummary } from '../score/compute';

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

/**
 * Multi-scorecard variant of `RunOptions`. The crawl + fetch path is
 * identical; only the scoring fan-out differs. Each version listed here
 * produces one `SiteRun` in the returned array.
 */
export interface MultiRunOptions extends Omit<RunOptions, 'scorecardVersion'> {
  /** Scorecard versions to evaluate against. Duplicates are de-duped. */
  scorecardVersions: string[];
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
 *
 * Thin wrapper around `validateMulti` for the single-scorecard case so the
 * existing single-scorecard public API doesn't change shape.
 */
export async function validate(opts: RunOptions): Promise<SiteRun> {
  const { scorecardVersion, ...rest } = opts;
  const results = await validateMulti({
    ...rest,
    scorecardVersions: [scorecardVersion ?? LATEST_SCORECARD],
  });
  return results[0];
}

/**
 * Multi-scorecard variant: scores the same crawl against every listed
 * scorecard version, returning one `SiteRun` per version. Page fetch and
 * crawl machinery is shared across all scorecards; only the check
 * dispatch fans out.
 *
 * For each unique `(check_id, implementationVersion)` pair across all
 * resolved scorecards, the underlying check `run()` is invoked exactly
 * once per context (site context, or one per fetched page). Two
 * scorecards that pin the same impl share the same `CheckOutcome`
 * value; two scorecards that pin different impls each get their own.
 * The resulting `CheckResult` carries the scorecard-specific `docsUrl`
 * so reports always link to the right version's docs page.
 */
export async function validateMulti(opts: MultiRunOptions): Promise<SiteRun[]> {
  const mode: RunMode = opts.mode ?? 'page';
  if (opts.scorecardVersions.length === 0) {
    throw new Error('validateMulti requires at least one scorecard version');
  }
  // Dedupe while preserving insertion order so output order is
  // deterministic and matches what the caller passed in.
  const versions = Array.from(new Set(opts.scorecardVersions));
  const scorecards = versions.map((v) => getScorecard(v));
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

  // The progress stream is single-channel; emit the first scorecard's
  // version on `started` so the spinner and verbose logs read coherently
  // for the (overwhelmingly common) single-scorecard case. Multi-scorecard
  // callers know to use `scorecardVersions` directly.
  opts.onProgress?.({
    type: 'started',
    mode,
    url: opts.url,
    scorecardVersion: scorecards[0].version,
  });

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

  // Union the resolved checks across all scorecards. Each unique
  // `(check_id, implementationVersion)` pair fires once; scorecards that
  // pin the same pair share the underlying outcome.
  const siteCheckUnion = buildCheckUnion(scorecards.flatMap((s) => s.siteChecks));
  const pageCheckUnion = buildCheckUnion(scorecards.flatMap((s) => s.pageChecks));

  // Site checks fan out independently of page checks. Kick them off in
  // parallel with page processing so they're ready by the time the crawl
  // finishes.
  const siteOutcomesPromise = runCheckUnion(siteCheckUnion, siteCtx);

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
  // One PageReport accumulator per scorecard. The same fetch produces one
  // PageReport per scorecard; the scorecards differ only in which
  // (id, impl) firings they pull out of the per-page outcome map.
  const pagesByScorecard = new Map<string, PageReport[]>();
  for (const sc of scorecards) pagesByScorecard.set(sc.version, []);

  const handlePage = (input: DiscoveredPage): Promise<void> =>
    pageCheckQueue.add(async () => {
      const ctx: PageCheckContext = {
        scope: 'page',
        baseUrl,
        http,
        shared,
        url: input.page.url,
        page: input.page,
      };
      const pageOutcomes = await runCheckUnion(pageCheckUnion, ctx);

      for (const sc of scorecards) {
        const checks = sc.pageChecks.map((c) =>
          buildResult(c, 'page', pageOutcomes, sc.version),
        );
        // Per-page summaries always use flat-pool semantics regardless of the
        // site-level scoringMethodology: the per-page score is "how many of this
        // page's applicable checks passed," which is a different question from
        // the site's aggregate score. Methodology only affects the site summary
        // below.
        const summary = summarize(checks, 'flat-pool-v1');
        pagesByScorecard.get(sc.version)!.push({
          url: input.page.originalUrl,
          finalUrl: input.page.url,
          status: input.page.status,
          sources: [...input.sources],
          checks,
          summary,
        });
      }

      // Emit page-done for the first scorecard's view of this page so the
      // single-channel progress stream stays interpretable.
      const firstPages = pagesByScorecard.get(scorecards[0].version)!;
      const last = firstPages[firstPages.length - 1];
      opts.onProgress?.({
        type: 'page-done',
        url: last.finalUrl,
        passed: last.summary.passed,
        total: last.summary.total,
      });

      // Release the FetchedPage so cheerio + the body string can be
      // garbage-collected before the next page's checks claim a slot.
      // Also drop this page's per-page cache entries from the shared
      // map (jsonLd parse + markdown mirror body) — they're only ever
      // used by the checks for this same URL.
      const finalUrl = input.page.url;
      (input as { page: unknown }).page = null;
      shared.delete(`page:json-ld:${finalUrl}`);
      shared.delete(`page:md-mirror:${finalUrl}`);
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

  const siteOutcomes = await siteOutcomesPromise;
  const finishedAt = new Date().toISOString();

  // Per-scorecard site-check arrays + final SiteRun assembly.
  const siteRuns: SiteRun[] = scorecards.map((sc) => {
    const siteChecks = sc.siteChecks.map((c) =>
      buildResult(c, 'site', siteOutcomes, sc.version),
    );
    const pages = pagesByScorecard.get(sc.version)!;
    const allChecks: CheckResult[] = [
      ...siteChecks,
      ...pages.flatMap((p) => p.checks),
    ];
    const summary = summarize(allChecks, sc.scoringMethodology);
    return {
      url: opts.url,
      baseUrl,
      mode,
      scorecardVersion: sc.version,
      scorecardReleasedAt: sc.releasedAt,
      scoringMethodology: sc.scoringMethodology,
      startedAt,
      finishedAt,
      siteChecks,
      pages,
      summary,
    };
  });

  // Emit per-site-check progress events for the first scorecard's view.
  // Each site-check firing is unique by (id, impl), and the first
  // scorecard sees a complete set of its pinned checks. Surfacing the
  // first one's view keeps the existing single-scorecard progress
  // semantics intact.
  for (const r of siteRuns[0].siteChecks) {
    opts.onProgress?.({ type: 'site-check-done', result: r });
  }
  opts.onProgress?.({ type: 'finished', summary: siteRuns[0].summary });

  return siteRuns;
}

interface UnionEntry {
  check: ResolvedCheck;
}

/**
 * Build a deduplicated map of `(check_id, implementationVersion) -> ResolvedCheck`.
 * Two scorecards that pin the same impl of the same check share one entry,
 * so the underlying `run()` is invoked exactly once per fan-out.
 */
function buildCheckUnion(checks: ResolvedCheck[]): Map<string, UnionEntry> {
  const map = new Map<string, UnionEntry>();
  for (const c of checks) {
    const key = unionKey(c.id, c.implementationVersion);
    if (!map.has(key)) map.set(key, { check: c });
  }
  return map;
}

function unionKey(id: string, implementationVersion: string): string {
  return `${id}@${implementationVersion}`;
}

/**
 * Run every unique check in the union against the given context. Each
 * check's `run()` is invoked exactly once; an unexpected throw is folded
 * into an `error`-status outcome the same way a single-scorecard run
 * would have produced. Returns a map keyed by the union key so callers
 * can dispatch outcomes back into per-scorecard CheckResults.
 */
async function runCheckUnion(
  union: Map<string, UnionEntry>,
  ctx: SiteCheckContext | PageCheckContext,
): Promise<Map<string, CheckOutcome>> {
  const out = new Map<string, CheckOutcome>();
  await Promise.all(
    [...union.entries()].map(async ([key, { check }]) => {
      try {
        const outcome = await check.run(ctx);
        out.set(key, outcome);
      } catch (e) {
        out.set(key, { status: 'error', message: (e as Error).message });
      }
    }),
  );
  return out;
}

function buildResult(
  check: ResolvedCheck,
  scope: 'site' | 'page',
  outcomes: Map<string, CheckOutcome>,
  scorecardVersion: string,
): CheckResult {
  const outcome = outcomes.get(unionKey(check.id, check.implementationVersion));
  // The union always covers every pinned (id, impl) before we reach this
  // helper, so a miss is a programmer error rather than a runtime case
  // to handle gracefully — surface it loudly.
  if (!outcome) {
    throw new Error(
      `Internal: no outcome for ${check.id}@${check.implementationVersion} ` +
        `while assembling scorecard ${scorecardVersion}`,
    );
  }
  return {
    id: check.id,
    name: check.name,
    group: check.group,
    scope,
    implementationVersion: check.implementationVersion,
    status: outcome.status,
    message: outcome.message,
    details: outcome.details,
    docsUrl: buildCheckDocsUrl(scorecardVersion, check.id),
  };
}

// Re-export for ergonomic single import.
export { type ResolvedScorecard };
