/**
 * Loader for the **bulk** leaderboard tier (CrUX-fed, page-mode, web-scale).
 *
 * Distinct from the curated `research-data.ts`: bulk leaderboards have no
 * editorial category/taxonomy, carry adoption signal counts, and use string
 * score buckets. Per-version files live at `src/data/bulk/<version>.json`
 * (mirroring the curated `leaderboard/<version>.json` convention) and are read
 * with `fs` at build time so a fresh checkout without the (embargoed) data
 * degrades gracefully instead of failing the Vite build.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { compareScorecardVersions, type ScoreHistogramBucket } from '~/lib/research-data';

export interface BulkAdoption {
  total: number;
  llmsTxt: number;
  agentsMd: number;
  sitemap: number;
  robots: number;
}

export interface BulkCheckAdoption {
  checkId: string;
  name: string;
  group?: string;
  scope: 'site' | 'page';
  applicable: number;
  passing: number;
}

/**
 * Compact per-site entry. The data files are pre-slimmed (50k+ rows at 100k):
 * heavy per-entry `summary` objects are dropped and signals packed to a bitmask
 * so the page can embed the whole set and paginate/search it client-side.
 */
export interface BulkEntry {
  /** Host without scheme, e.g. "www.example.com". Link is `https://<o>`. */
  o: string;
  /** Score 0-100. */
  s: number;
  /** Signal bitmask: 1=llms.txt, 2=AGENTS.md, 4=sitemap, 8=robots.txt. */
  g: number;
  /** Up to 2 top failing check ids. */
  f: string[];
}

/** Bit positions for the `g` signal bitmask, in display order. */
export const SIGNAL_BITS = [
  { key: 'llmsTxt', bit: 1, label: 'llms.txt' },
  { key: 'agentsMd', bit: 2, label: 'AGENTS.md' },
  { key: 'sitemap', bit: 4, label: 'sitemap' },
  { key: 'robots', bit: 8, label: 'robots.txt' },
] as const;

export interface BulkLeaderboard {
  kind: 'bulk';
  scorecardVersion: string;
  generatedAt: string;
  /** Provenance, e.g. "crux batch-2026-06-11". */
  source: string;
  totalScanned: number;
  adoption: BulkAdoption;
  checkAdoption: BulkCheckAdoption[];
  scoreHistogram: Array<{ bucket: string; count: number }>;
  entries: BulkEntry[];
}

const BULK_DIR = resolve(process.cwd(), 'src', 'data', 'bulk');

const LOADED: { versions: string[]; byVersion: Record<string, BulkLeaderboard> } = (() => {
  if (!existsSync(BULK_DIR)) return { versions: [], byVersion: {} };
  let files: string[];
  try {
    files = readdirSync(BULK_DIR);
  } catch {
    return { versions: [], byVersion: {} };
  }
  const byVersion: Record<string, BulkLeaderboard> = {};
  for (const f of files) {
    if (!f.endsWith('.json') || f === 'latest.json') continue;
    const version = f.slice(0, -'.json'.length);
    try {
      const parsed = JSON.parse(readFileSync(join(BULK_DIR, f), 'utf8')) as BulkLeaderboard;
      if (parsed.kind === 'bulk' && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        byVersion[version] = parsed;
      }
    } catch {
      // skip malformed file
    }
  }
  const versions = Object.keys(byVersion).sort((a, b) => compareScorecardVersions(b, a));
  return { versions, byVersion };
})();

/** Bulk scorecard versions with data on disk, newest → oldest. */
export function listBulkVersions(): string[] {
  return [...LOADED.versions];
}

/**
 * Default version for the bulk page: the newest NON-draft (published) version,
 * falling back to the newest of any kind. Mirrors the leaderboard policy that
 * the public default is the latest published scorecard, with drafts selectable.
 */
export function getDefaultBulkVersion(): string | null {
  const published = LOADED.versions.find((v) => !v.includes('-'));
  return published ?? LOADED.versions[0] ?? null;
}

export function getBulkLeaderboard(version: string): BulkLeaderboard {
  const found = LOADED.byVersion[version];
  if (!found) {
    throw new Error(
      `No bulk leaderboard for "${version}". Known: ${LOADED.versions.join(', ') || '(none)'}`,
    );
  }
  return found;
}

/** Map the bulk `{bucket, count}` histogram into the ScoreHistogram prop shape. */
export function bulkHistogramBuckets(lb: BulkLeaderboard): ScoreHistogramBucket[] {
  return lb.scoreHistogram.map((b) => {
    const [from, to] = b.bucket.split('-').map((n) => parseInt(n, 10));
    return { from: from || 0, to: to || 0, label: b.bucket, n: b.count };
  });
}

/** Adoption percentages (0-100, rounded) for the four agent-readiness signals. */
export function bulkAdoptionPct(lb: BulkLeaderboard): Record<keyof Omit<BulkAdoption, 'total'>, number> {
  const t = lb.adoption.total || 1;
  const pct = (n: number) => Math.round((n / t) * 100);
  return {
    llmsTxt: pct(lb.adoption.llmsTxt),
    agentsMd: pct(lb.adoption.agentsMd),
    sitemap: pct(lb.adoption.sitemap),
    robots: pct(lb.adoption.robots),
  };
}

export function bulkMeanScore(lb: BulkLeaderboard): number {
  if (!lb.entries.length) return 0;
  return Math.round((lb.entries.reduce((sum, e) => sum + e.s, 0) / lb.entries.length) * 10) / 10;
}

/** Display theme per check-id prefix, in narrative order. */
const THEME_RULES: Array<[RegExp, string]> = [
  [/^llms-txt\.|^robots-txt\.|^sitemap-|^agents-md\.|^discovery\./, 'Discoverability'],
  [/^markdown\./, 'Markdown mirror'],
  [/^html\.json-ld/, 'Structured data'],
  [/^html\.(headings|text-ratio|glossary|ssr-content)/, 'Content structure'],
  [/^html\./, 'HTML metadata'],
  [/^http\./, 'HTTP'],
  [/^code\./, 'Code'],
  [/^api\./, 'API'],
];

export function themeForCheck(checkId: string): string {
  for (const [re, theme] of THEME_RULES) if (re.test(checkId)) return theme;
  return 'Other';
}

export function checkAdoptionPct(c: BulkCheckAdoption, total: number): { ofAll: number; ofApplicable: number } {
  return {
    ofAll: total ? Math.round((c.passing / total) * 100) : 0,
    ofApplicable: c.applicable ? Math.round((c.passing / c.applicable) * 100) : 0,
  };
}
