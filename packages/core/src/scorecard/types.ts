import type { FetchedPage, HttpClient } from '../fetch/types';

export type CheckScope = 'site' | 'page';

/**
 * Resources surfaced by `collectSeeds`. The CLI uses these to render
 * progress so the user sees movement during long sitemap-index reads.
 */
export type SeedResource = 'llms-txt' | 'sitemap-xml' | 'sitemap-md';

export type SeedProgressEvent =
  | { kind: 'start'; resource: SeedResource }
  | {
      kind: 'child';
      resource: 'sitemap-xml';
      visited: number;
      total: number;
    }
  | { kind: 'done'; resource: SeedResource; found: boolean };

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'error' | 'na';

export interface CheckOutcome {
  status: CheckStatus;
  /** Short human-readable summary shown in reports. */
  message?: string;
  /** Optional structured payload for the UI to render. */
  details?: unknown;
}

export interface BaseCheckContext {
  /** Base origin of the site being audited (no path). */
  baseUrl: string;
  http: HttpClient;
  /**
   * Per-run shared cache. Site-level checks deposit findings here (parsed
   * llms.txt, sitemap URL set, etc.) so page-level checks can avoid refetching
   * the same resources. Keys are scoped by stable check id.
   */
  shared: Map<string, unknown>;
}

export interface SiteCheckContext extends BaseCheckContext {
  scope: 'site';
  /**
   * Pathname prefix the audited site is hosted under, derived from the
   * user-provided URL. Empty string for sites at the origin root,
   * `"/a14y"` (no trailing slash) for subpath-hosted sites.
   * Site-level loaders use this to look for well-known files at both
   * `<origin>/<prefix>/well-known.ext` AND `<origin>/well-known.ext`,
   * preferring the subpath-rooted hit so the right file wins on shared
   * domains where the user doesn't control the top level.
   */
  sitePrefix?: string;
  /**
   * Optional callback that lets seed loaders stream progress out of
   * `collectSeeds` (start/done per resource, plus per-child events when
   * walking a sitemapindex). The runner wires this into its `onProgress`
   * stream so the CLI spinner can render movement during long reads.
   */
  onSeedProgress?: (event: SeedProgressEvent) => void;
}

export interface PageCheckContext extends BaseCheckContext {
  scope: 'page';
  /** Final URL of the page under inspection. */
  url: string;
  page: FetchedPage;
}

export type CheckContext = SiteCheckContext | PageCheckContext;

/**
 * One historical implementation of a check. Bumping the implementation
 * version is how a check's behavior evolves: existing scorecards keep
 * pointing at the old version forever, new scorecards opt into the new one.
 */
export interface CheckImpl<C extends CheckContext = CheckContext> {
  /** Semver. Bumped whenever observable behavior changes. */
  version: string;
  description: string;
  run: (ctx: C) => Promise<CheckOutcome>;
}

/**
 * The full registry entry for one stable check id. Contains every
 * implementation that has ever shipped, keyed by version string.
 */
export interface CheckSpec<C extends CheckContext = CheckContext> {
  /** Stable id, never renamed. e.g. "html.canonical-link". */
  id: string;
  scope: C['scope'];
  /** Display name. Safe to change without breaking score comparability. */
  name: string;
  /** Optional grouping for UI rendering, e.g. "HTML metadata". */
  group?: string;
  implementations: Record<string, CheckImpl<C>>;
}

export type SiteCheckSpec = CheckSpec<SiteCheckContext>;
export type PageCheckSpec = CheckSpec<PageCheckContext>;

/**
 * How a scorecard turns per-check pass/fail results into a single 0-100 score.
 * Pinned per-manifest so scoring evolves through the same immutability contract
 * as the check set itself — a consumer pinned to v0.2.0 gets the same score
 * forever, even if a later scorecard adopts a different aggregation.
 *
 * - `flat-pool-v1` — `round(100 × passed / applicable)` over the flat pool of
 *   site + per-page check results. The original v0.2.0 algorithm. Site-wide
 *   check signals get diluted as page count grows because every page's
 *   per-page-check firings join the same denominator.
 * - `per-check-mean-v1` — `round(mean({passed/applicable for each check_id
 *   with applicable > 0}))`. Each distinct check identity contributes one
 *   observation regardless of how many pages it fires on; eliminates the
 *   page-count dependence in site-wide check signals. Introduced in the
 *   v0.3.0-draft scorecard. See /scorecards/methodologies/per-check-mean-v1/
 *   for the rationale + worked example.
 *
 * New variants are added as new string literals and dispatched from
 * `score/compute.ts`. Once a published manifest references a variant, that
 * variant's behavior is frozen forever.
 */
export type ScoringMethodology = 'flat-pool-v1' | 'per-check-mean-v1';

/**
 * A scorecard manifest pins each check id to a single implementation version.
 * Scorecard files (v0_2.ts, v0_3.ts, ...) are FROZEN once shipped; updating a
 * check means publishing a new scorecard version that points at the new impl.
 *
 * Exactly one mutable manifest exists at any time — the draft scorecard at
 * `scorecard/draft.ts`, with a semver pre-release version like `0.3.0-draft`.
 * Contributions to the rubric (new check ids, bumped impl versions, removed
 * checks) land there. On cut day the draft is copied to the next frozen file
 * and a new draft is opened. See CONTRIBUTING.md and RELEASING.md.
 */
export interface ScorecardManifest {
  version: string;
  releasedAt: string;
  description: string;
  /** Map of check id -> implementation version. */
  checks: Record<string, string>;
  /**
   * How this scorecard aggregates check results into a final score. Optional
   * for backwards compatibility with manifests authored before this field
   * existed; `getScorecard()` defaults missing values to `'flat-pool-v1'`.
   */
  scoringMethodology?: ScoringMethodology;
}

/**
 * A resolved scorecard is a manifest with every check id looked up in the
 * registry and bound to its concrete implementation, ready for the runner.
 */
export interface ResolvedCheck {
  id: string;
  scope: CheckScope;
  name: string;
  group?: string;
  implementationVersion: string;
  description: string;
  run: (ctx: CheckContext) => Promise<CheckOutcome>;
}

export interface ResolvedScorecard {
  version: string;
  releasedAt: string;
  description: string;
  /** Pinned per-manifest; defaulted by the resolver to `'flat-pool-v1'`. */
  scoringMethodology: ScoringMethodology;
  siteChecks: ResolvedCheck[];
  pageChecks: ResolvedCheck[];
}
