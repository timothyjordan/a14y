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
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RUNS_DIR = resolve(process.cwd(), 'src', 'data', 'runs');

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

export async function loadSiteRun(slug: string): Promise<SiteRun | null> {
  if (!SLUGS.includes(slug)) return null;
  const raw = readFileSync(join(RUNS_DIR, `${slug}.json`), 'utf8');
  return JSON.parse(raw) as SiteRun;
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
