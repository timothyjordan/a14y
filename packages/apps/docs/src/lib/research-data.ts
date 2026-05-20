/**
 * Loaders for the `/leaderboard/` page. Two data shapes coexist:
 *
 * - **Legacy single-scorecard** (always present): `src/data/research.json`,
 *   produced by `@a14y/research`'s pre-TJ-583 publish path. Used by
 *   pages that only render the promoted scorecard.
 * - **Multi-scorecard** (present once TJ-583 publish runs):
 *   `src/data/leaderboard/<version>.json` for each scorecard the
 *   internal pipeline ran, plus `src/data/leaderboard/latest.json` as
 *   an alias of the promoted version. The selector UI reads these and
 *   the legacy file is kept as a backwards-compat mirror of the
 *   promoted version.
 *
 * The static-build constraint: keep legacy import (`import researchData
 * from '~/data/research.json'`) for the always-present file so Vite can
 * inline it at build time, but use `fs` for the per-version files —
 * they may be absent on fresh checkouts and Vite would error on a
 * missing import.
 */
import researchData from '~/data/research.json';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type SiteCategory =
  | 'docs-platform'
  | 'consumer'
  | 'dev-tool'
  | 'enterprise'
  | 'reference';

export type RunMode = 'page' | 'site';

export interface LeaderboardEntry {
  slug: string;
  name: string;
  url: string;
  category: SiteCategory;
  mode: RunMode;
  score: number;
  summary: {
    passed: number;
    failed: number;
    warned: number;
    errored: number;
    na: number;
    total: number;
    applicable: number;
  };
  topFailures: string[];
  scannedAt: string;
}

export interface CategoryStat {
  category: SiteCategory;
  n: number;
  meanScore: number;
  medianScore: number;
}

export interface ScoreHistogramBucket {
  from: number;
  to: number;
  label: string;
  n: number;
}

export interface CheckPassRate {
  checkId: string;
  name: string;
  group?: string;
  scope: 'site' | 'page';
  applicableSites: number;
  passingSites: number;
  passRate: number;
}

/**
 * Pinned per-scorecard scoring methodology. Mirrors `@a14y/core`'s
 * `ScoringMethodology` literal union. Optional because leaderboard
 * artifacts produced before TJ-559 lack the field.
 */
export type ScoringMethodology = 'flat-pool-v1' | 'per-check-mean-v1';

export interface ResearchData {
  scorecardVersion: string;
  scorecardReleasedAt: string;
  /** Pinned scoring methodology that produced these scores. Optional for legacy artifacts. */
  scoringMethodology?: ScoringMethodology;
  generatedAt: string;
  sites: LeaderboardEntry[];
  stats: {
    byCategory: CategoryStat[];
    scoreHistogram: ScoreHistogramBucket[];
    checkPassRates: CheckPassRate[];
  };
}

const data = researchData as ResearchData;

// Per-version leaderboard files live at `src/data/leaderboard/<version>.json`
// alongside an unversioned `latest.json` alias that mirrors the promoted
// version. Discovered at build time so the directory is allowed to be
// absent on fresh checkouts (the page degrades to single-scorecard mode).
const LEADERBOARD_DIR = resolve(process.cwd(), 'src', 'data', 'leaderboard');

interface VersionedLeaderboards {
  versions: string[];
  byVersion: Record<string, ResearchData>;
  /** Version that `latest.json` aliases (when the alias file is present). */
  promoted: string | null;
}

const VERSIONED: VersionedLeaderboards = (() => {
  // Best-effort: read every `<version>.json` (skipping the `latest.json`
  // alias) and the alias itself. We tolerate any single file being
  // malformed so a typo in one version's data doesn't take down the
  // whole site build — instead that version is silently dropped from
  // the selector.
  if (!existsSync(LEADERBOARD_DIR)) {
    return { versions: [], byVersion: {}, promoted: null };
  }
  let entries: string[];
  try {
    entries = readdirSync(LEADERBOARD_DIR);
  } catch {
    return { versions: [], byVersion: {}, promoted: null };
  }
  const byVersion: Record<string, ResearchData> = {};
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    if (f === 'latest.json') continue;
    const version = f.slice(0, -'.json'.length);
    try {
      const raw = readFileSync(join(LEADERBOARD_DIR, f), 'utf8');
      byVersion[version] = JSON.parse(raw) as ResearchData;
    } catch {
      // Skip malformed file; the version is dropped from the selector.
    }
  }
  let promoted: string | null = null;
  if (entries.includes('latest.json')) {
    try {
      const raw = readFileSync(join(LEADERBOARD_DIR, 'latest.json'), 'utf8');
      promoted = (JSON.parse(raw) as ResearchData).scorecardVersion;
    } catch {
      promoted = null;
    }
  }
  const versions = Object.keys(byVersion).sort();
  return { versions, byVersion, promoted };
})();

/**
 * Returns the list of scorecard versions for which a per-version
 * leaderboard file is available. Empty in single-scorecard mode (no
 * `leaderboard/` directory yet) — pages should fall back to the legacy
 * `getResearchData()` in that case.
 */
export function listAvailableScorecards(): string[] {
  return [...VERSIONED.versions];
}

/**
 * The scorecard version that `latest.json` aliases. Drives the default
 * selector position. Returns null when no per-version data is available
 * yet — callers should use `data.scorecardVersion` as the fallback.
 */
export function getPromotedScorecard(): string | null {
  return VERSIONED.promoted;
}

/**
 * Read a specific scorecard version's leaderboard. Throws if the
 * version isn't in `listAvailableScorecards()` — callers are expected
 * to gate on availability first.
 */
export function getResearchDataFor(version: string): ResearchData {
  const found = VERSIONED.byVersion[version];
  if (!found) {
    throw new Error(
      `No leaderboard data for scorecard "${version}". Known versions: ${VERSIONED.versions.join(', ') || '(none)'}`,
    );
  }
  return found;
}

export function getResearchData(): ResearchData {
  return data;
}

export function getLeaderboard(): LeaderboardEntry[] {
  return data.sites;
}

export function getCategoryStats(): CategoryStat[] {
  return data.stats.byCategory;
}

export function getScoreHistogram(): ScoreHistogramBucket[] {
  return data.stats.scoreHistogram;
}

/**
 * Returns the N hardest checks (lowest pass rate) where at least
 * `minApplicable` sites had the check applicable. The threshold filters
 * out checks that only one or two sites trigger, which would otherwise
 * dominate the bottom of the list.
 */
export function getHardestChecks(n = 12, minApplicable = 5): CheckPassRate[] {
  return data.stats.checkPassRates
    .filter((c) => c.applicableSites >= minApplicable)
    .slice(0, n);
}

export const CATEGORY_LABELS: Record<SiteCategory, string> = {
  'docs-platform': 'Docs platform',
  'dev-tool': 'Dev tool',
  enterprise: 'Enterprise SaaS',
  reference: 'Reference',
  consumer: 'Consumer',
};

/**
 * Bucket name used for color coding scores in the leaderboard.
 *  excellent ≥85, good ≥70, fair ≥50, poor <50.
 */
export function scoreBand(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

/**
 * Build the docs URL for a scorecard check, e.g. "html.glossary-link" →
 * "/scorecards/0.2.0/checks/html.glossary-link/". Honors the site's
 * BASE_URL so it works correctly when deployed under a non-root path.
 */
export function checkDocsUrl(scorecardVersion: string, checkId: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return `${base}/scorecards/${scorecardVersion}/checks/${checkId}/`;
}

/** Share of catalog sites where every site-level llms.txt check passed. */
export function getLlmsTxtAdoption(): { passing: number; total: number; pct: number } {
  const llmsExists = data.stats.checkPassRates.find((c) => c.checkId === 'llms-txt.exists');
  if (!llmsExists) return { passing: 0, total: 0, pct: 0 };
  const pct =
    llmsExists.applicableSites === 0
      ? 0
      : Math.round((llmsExists.passingSites / llmsExists.applicableSites) * 100);
  return {
    passing: llmsExists.passingSites,
    total: llmsExists.applicableSites,
    pct,
  };
}

/** The check id that appears most often in any site's topFailures list across the catalog. */
export function getMostCommonTopFailure(): { checkId: string; siteCount: number } | null {
  const counts = new Map<string, number>();
  for (const site of data.sites) {
    for (const id of site.topFailures) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  let best: { checkId: string; siteCount: number } | null = null;
  for (const [checkId, n] of counts) {
    if (!best || n > best.siteCount) best = { checkId, siteCount: n };
  }
  return best;
}
