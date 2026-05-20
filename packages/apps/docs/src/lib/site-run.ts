/**
 * Loaders for the per-site scorecard pages at `/leaderboard/<slug>/`. Each
 * full SiteRun JSON is published from the private a14y-internal repo into
 * `src/data/runs/<slug>.json` by the `@a14y/research` publish command.
 *
 * **Bypass Vite's bundler.** The catalog has 240+ run files totalling 100+ MB
 * after trimming. Anything based on `import.meta.glob` (eager or lazy) pulls
 * all of them into Vite's module graph during the static build pass and
 * crashes Node's heap. Instead we read the files directly with `fs` at
 * render time — Vite never sees the JSON, the bundler stays small, and
 * each per-page render only holds its own SiteRun in memory.
 *
 * Types come from @a14y/core so the public site renders the exact
 * shape the CLI and extension produce.
 */
import type { SiteRun } from '@a14y/core';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RUNS_DIR = resolve(process.cwd(), 'src', 'data', 'runs');
const LEADERBOARD_DIR = resolve(process.cwd(), 'src', 'data', 'leaderboard');

const SLUGS: string[] = (() => {
  try {
    return readdirSync(RUNS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .sort();
  } catch {
    // Fresh checkouts before `pnpm --filter @a14y/research start publish`
    // has been run won't have a runs/ dir. Empty list lets the dynamic
    // route resolve to no params instead of throwing at build time.
    return [];
  }
})();

/**
 * Per-version SiteRun lookup. After TJ-583 publish runs, runs land at
 * `src/data/leaderboard/<version>/runs/<slug>.json` alongside the
 * legacy `src/data/runs/<slug>.json` (which mirrors the promoted
 * version for backwards-compat). Discovered at build time so the
 * directory is allowed to be absent on single-scorecard publishes.
 */
const VERSIONED_RUN_VERSIONS: string[] = (() => {
  if (!existsSync(LEADERBOARD_DIR)) return [];
  try {
    return readdirSync(LEADERBOARD_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => existsSync(join(LEADERBOARD_DIR, name, 'runs')))
      .sort();
  } catch {
    return [];
  }
})();

/**
 * Load the SiteRun for a slug. When `version` is provided and a
 * per-version run file exists, that file is read; otherwise the legacy
 * `runs/<slug>.json` is returned. Returns null if the slug isn't
 * known to either tree.
 */
export async function loadSiteRun(slug: string, version?: string): Promise<SiteRun | null> {
  if (version) {
    const versioned = join(LEADERBOARD_DIR, version, 'runs', `${slug}.json`);
    if (existsSync(versioned)) {
      const raw = readFileSync(versioned, 'utf8');
      return JSON.parse(raw) as SiteRun;
    }
  }
  if (!SLUGS.includes(slug)) return null;
  const raw = readFileSync(join(RUNS_DIR, `${slug}.json`), 'utf8');
  return JSON.parse(raw) as SiteRun;
}

/**
 * Scorecard versions for which a `leaderboard/<version>/runs/`
 * directory was published. Empty in single-scorecard mode. Callers use
 * this to know which selector options to render on per-site pages.
 */
export function listVersionedRunScorecards(): string[] {
  return [...VERSIONED_RUN_VERSIONS];
}

export function listSiteRunSlugs(): string[] {
  return [...SLUGS];
}

/**
 * Extension-compatible thresholds (≥90 pass, ≥70 warn, else fail). Used to
 * color per-page score chips on the scorecard page so they match the same
 * green/yellow/red bands users see in the extension's results UI.
 */
export function scoreClass(score: number): 'pass' | 'warn' | 'fail' {
  if (score >= 90) return 'pass';
  if (score >= 70) return 'warn';
  return 'fail';
}

/**
 * Build the path to a per-site scorecard page, honoring BASE_URL so it
 * works both at the root and under a deploy-prefix.
 */
export function siteRunUrl(slug: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return `${base}/leaderboard/${slug}/`;
}
