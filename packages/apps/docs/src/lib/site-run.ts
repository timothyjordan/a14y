/**
 * Loaders for the per-site scorecard pages at `/research/<slug>/`. Each
 * full SiteRun JSON is published from the private a14y-internal repo into
 * `src/data/runs/<slug>.json` by the `@a14y/research` publish command.
 * Astro reads them at build time via `import.meta.glob`; the dynamic route
 * `pages/research/[slug]/index.astro` consumes these helpers in
 * `getStaticPaths()` and at render time.
 *
 * Types come from @a14y/core so the public site renders the exact shape
 * the CLI and extension produce.
 */
import type { SiteRun } from '@a14y/core';

const RUN_MODULES = import.meta.glob<{ default: SiteRun }>('../data/runs/*.json', {
  eager: true,
});

const RUNS_BY_SLUG: Record<string, SiteRun> = (() => {
  const out: Record<string, SiteRun> = {};
  for (const [path, mod] of Object.entries(RUN_MODULES)) {
    const slug = path.split('/').pop()!.replace(/\.json$/, '');
    out[slug] = mod.default;
  }
  return out;
})();

export function loadSiteRun(slug: string): SiteRun | null {
  return RUNS_BY_SLUG[slug] ?? null;
}

export function listSiteRunSlugs(): string[] {
  return Object.keys(RUNS_BY_SLUG).sort();
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
  return `${base}/research/${slug}/`;
}
