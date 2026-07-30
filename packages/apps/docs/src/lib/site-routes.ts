/**
 * Single source of truth for "every URL this site publishes".
 *
 * The discovery files (sitemap.xml, sitemap.md, llms.txt) used to be
 * built from a hand-maintained array of paths. That array silently fell
 * behind the real routes: `/leaderboard/` and its 326 site pages,
 * `/badge/`, `/badge/how-to-embed/`, `/scorecards/scoring/`,
 * `/scorecards/<version>/changes/`, and four of the five `/research/`
 * articles were all live and returning 200 while being absent from
 * every discovery surface. Search engines were told about 95 of ~425
 * pages.
 *
 * So routes are derived from `src/pages/` instead of restated:
 *
 * - **Static routes** (no `[param]` segment) are picked up from the
 *   filesystem automatically. Adding `src/pages/research/foo.astro`
 *   puts `/research/foo/` in the sitemap with no other edit. This is
 *   where the old drift happened, and it is now impossible.
 * - **Dynamic routes** need an explicit entry in `DYNAMIC_ROUTES`
 *   below, because only the page's own `getStaticPaths` knows which
 *   params are real. A dynamic route file with no entry throws at
 *   build time rather than quietly contributing nothing.
 *
 * The integration runs at `astro:config:setup`, before Astro has a
 * route manifest or content collections, so this module reads the
 * pages directory and the data loaders directly.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { listAllScorecards } from './scorecard-data';
import { listSiteRunSlugs } from './site-run';
import { getLeaderboard } from './research-data';

// Deliberately the same cwd-relative idiom as site-run.ts and
// research-data.ts, which is what the page routes themselves resolve
// against. Resolving this module differently (from import.meta.url,
// say) looks more robust but is worse: Astro loads the config and the
// pages through different module pipelines, so the two would disagree
// and the sitemap could announce URLs the build never produced.
// Sharing one base keeps the sitemap and the build in lock-step, and
// the guards in listSiteRoutes() turn a bad base into a failed build
// rather than a quietly de-listed site.
const PAGES_DIR = path.resolve(process.cwd(), 'src', 'pages');
const SCORING_CONTENT_DIR = path.resolve(process.cwd(), 'src', 'content', 'scoring');

/**
 * Concrete paths for each dynamic route pattern, keyed by the route as
 * it appears on disk (with `[param]` placeholders and a trailing
 * slash). Each expander mirrors the corresponding page's
 * `getStaticPaths`.
 */
const DYNAMIC_ROUTES: Record<string, () => string[]> = {
  '/leaderboard/[slug]/': () => {
    // Mirrors pages/leaderboard/[slug]/index.astro: leaderboard entries
    // are only routable once their full site run has been published.
    const entries = getLeaderboard();
    const published = new Set(listSiteRunSlugs());
    // A populated leaderboard with no published runs means the runs
    // directory failed to load, not that every site is unpublished.
    // Left alone that drops 300+ pages from the sitemap silently.
    if (entries.length > 0 && published.size === 0) {
      throw new Error(
        `[site-routes] The leaderboard has ${entries.length} entries but no published site runs ` +
          `resolved. src/data/runs/ is probably missing or unreadable. Refusing to build ` +
          `discovery files that would silently drop every /leaderboard/<slug>/ page.`,
      );
    }
    return entries
      .filter((entry) => published.has(entry.slug))
      .map((entry) => `/leaderboard/${entry.slug}/`);
  },

  '/scorecards/[version]/': () =>
    listAllScorecards().map((card) => `/scorecards/${card.version}/`),

  '/scorecards/[version]/changes/': () =>
    listAllScorecards().map((card) => `/scorecards/${card.version}/changes/`),

  '/scorecards/[version]/checks/[id]/': () => {
    // The page's getStaticPaths additionally filters these ids against
    // the `checks` content collection. Not filtering here is safe
    // because assertCoverageIntegration fails the build when a manifest
    // ships a check id with no content file, so the two sets cannot
    // diverge without the build going red first.
    const paths: string[] = [];
    for (const card of listAllScorecards()) {
      for (const id of Object.keys(card.checks)) {
        paths.push(`/scorecards/${card.version}/checks/${id}/`);
      }
    }
    return paths;
  },

  '/scorecards/scoring/[id]/': () => listScoringMethodologyIds().map((id) => `/scorecards/scoring/${id}/`),
};

/**
 * Routes the site builds on purpose but deliberately keeps out of the
 * discovery files. `/scorecards/draft/` is a friendly alias that
 * renders byte-identical content to `/scorecards/<n>-draft/`, so
 * advertising both would publish duplicate pages to search engines.
 * The alias keeps working for humans who type it; it just isn't
 * announced. Same for every check page under the alias.
 */
function isExcluded(url: string): boolean {
  return url.startsWith('/scorecards/draft/');
}

/**
 * Every canonical URL the site serves, trailing-slashed, sorted, and
 * deduplicated. Throws if `src/pages/` contains a dynamic route with
 * no expander registered above.
 */
export function listSiteRoutes(): string[] {
  const urls = new Set<string>();

  if (!existsSync(PAGES_DIR)) {
    throw new Error(
      `[site-routes] Pages directory not found at ${PAGES_DIR} (cwd: ${process.cwd()}). ` +
        `Discovery files must be generated with the docs package root as the working ` +
        `directory. Refusing to emit an empty sitemap.`,
    );
  }

  for (const route of listPageRoutes()) {
    if (route.includes('[')) {
      const expand = DYNAMIC_ROUTES[route];
      if (!expand) {
        throw new Error(
          `[site-routes] No path expander registered for the dynamic route "${route}". ` +
            `Add one to DYNAMIC_ROUTES in src/lib/site-routes.ts so the page reaches ` +
            `sitemap.xml, sitemap.md, and llms.txt, or the pages it builds will be ` +
            `invisible to search engines and agents.`,
        );
      }
      for (const url of expand()) urls.add(url);
    } else {
      urls.add(route);
    }
  }

  const routes = [...urls].filter((url) => !isExcluded(url)).sort(comparePaths);

  // An empty or near-empty result means the pages directory was not
  // found or not readable. Emitting the resulting sitemap would
  // de-list the entire site from search engines, which is far worse
  // than a failed build, so refuse rather than write it.
  if (routes.length < MIN_EXPECTED_ROUTES) {
    throw new Error(
      `[site-routes] Derived only ${routes.length} routes from ${PAGES_DIR}, expected at least ` +
        `${MIN_EXPECTED_ROUTES}. The pages directory is probably missing or unreadable. Refusing ` +
        `to build discovery files that would de-list the site.`,
    );
  }

  return routes;
}

/**
 * Floor for a sane route count. The site has hundreds of pages; this is
 * set well below the real number so ordinary content churn never trips
 * it, and well above zero so a broken path resolution always does.
 */
const MIN_EXPECTED_ROUTES = 20;

/**
 * Route patterns from the pages directory, e.g. `/`, `/badge/`,
 * `/research/web/`, `/scorecards/[version]/checks/[id]/`. Only
 * `.astro` pages are routes; endpoint files and colocated components
 * are not.
 */
export function listPageRoutes(): string[] {
  return walk(PAGES_DIR).map((absolute) => {
    const relative = path.relative(PAGES_DIR, absolute).split(path.sep).join('/');
    const withoutExt = relative.replace(/\.astro$/, '');
    const segments = withoutExt.split('/');
    // `foo/index.astro` and `foo.astro` both serve `/foo/`.
    if (segments[segments.length - 1] === 'index') segments.pop();
    return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
  });
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.name.endsWith('.astro')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Ids in the `scoring` content collection. Read from disk rather than
 * via `getCollection`, which is not available this early in the build.
 */
function listScoringMethodologyIds(): string[] {
  if (!existsSync(SCORING_CONTENT_DIR)) return [];
  return readdirSync(SCORING_CONTENT_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const raw = readFileSync(path.join(SCORING_CONTENT_DIR, name), 'utf8');
      const declared = /^id:\s*(.+)$/m.exec(raw)?.[1]?.trim();
      return declared || name.replace(/\.md$/, '');
    });
}

/** Landing page first, then alphabetical, so the sitemap reads sensibly. */
function comparePaths(a: string, b: string): number {
  if (a === '/') return -1;
  if (b === '/') return 1;
  return a.localeCompare(b);
}
