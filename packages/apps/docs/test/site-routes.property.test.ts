import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listSiteRoutes } from '../src/lib/site-routes';
import { getScorecardByVersion, listAllScorecards } from '~/lib/scorecard-data';
import { getLeaderboard } from '~/lib/research-data';
import { listSiteRunSlugs } from '~/lib/site-run';

/*
 * Property tests for `listSiteRoutes(): string[]`.
 *
 * Oracle: derived clean-room from `src/lib/site-routes.spec.md` and the
 * declared type facade ONLY. The implementation source
 * (`src/lib/site-routes.ts`) was deliberately never read; every assertion
 * below encodes a rule the spec states, not behavior observed in the code.
 *
 * `listSiteRoutes()` takes no arguments, so there is no input domain to
 * generate over. fast-check is not installed in this repo (and the request
 * forbids adding it), but generative sampling would buy nothing here anyway:
 * the output is a finite, fully enumerable set, so every property below is
 * checked EXHAUSTIVELY over every element (and, where the property is about
 * pairs, over the whole set at once). That is a complete proof of the
 * invariant for the current state of the site, which is strictly stronger
 * than sampling.
 *
 * The "real page" side of the containment properties is re-derived
 * independently by walking `src/pages/` inside this test. That walk is written
 * from Astro's documented file-routing rules plus the facade sentence
 * "Only `.astro` pages are routes; endpoint files and colocated components are
 * not." It is not a copy of the unit's own discovery logic.
 */

// ---------------------------------------------------------------------------
// Independent re-derivation of the site's route patterns from the filesystem
// ---------------------------------------------------------------------------

/** Walk up from this test file to the `@a14y/docs` package root. */
function findDocsRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (
      fs.existsSync(path.join(dir, 'src', 'pages')) &&
      fs.existsSync(path.join(dir, 'astro.config.ts'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('could not locate the docs package root from the test file');
}

const DOCS_ROOT = findDocsRoot();
const PAGES_DIR = path.join(DOCS_ROOT, 'src', 'pages');

/** Every file under `src/pages/`, as paths relative to `src/pages/`. */
function listPageDirFiles(dir = PAGES_DIR, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Astro treats a leading underscore as "not a route" (private /
    // colocated files and directories).
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...listPageDirFiles(path.join(dir, entry.name), rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out.sort();
}

const PAGE_DIR_FILES = listPageDirFiles();

/**
 * `.astro` page files only. Per the facade, endpoint files (`.ts`, `.js`,
 * `.json.ts`, ...) and colocated components are not routes.
 */
const ASTRO_PAGE_FILES = PAGE_DIR_FILES.filter((f) => f.endsWith('.astro'));

/**
 * `badge.astro`               -> `/badge/`
 * `index.astro`               -> `/`
 * `badge/how-to-embed.astro`  -> `/badge/how-to-embed/`
 * `leaderboard/[slug]/index.astro`
 *                             -> `/leaderboard/[slug]/`
 * `scorecards/[version]/checks/[id].astro`
 *                             -> `/scorecards/[version]/checks/[id]/`
 */
function fileToRoutePattern(relFile: string): string {
  const segments = relFile.replace(/\.astro$/, '').split('/');
  if (segments[segments.length - 1] === 'index') segments.pop();
  return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
}

const ROUTE_PATTERNS = Array.from(new Set(ASTRO_PAGE_FILES.map(fileToRoutePattern))).sort();

const isDynamicPattern = (pattern: string): boolean => pattern.includes('[');
const STATIC_PATTERNS = ROUTE_PATTERNS.filter((p) => !isDynamicPattern(p));
const DYNAMIC_PATTERNS = ROUTE_PATTERNS.filter(isDynamicPattern);

/** Compile a route pattern into a matcher: `[p]` = one segment, `[...p]` = many. */
function patternToRegExp(pattern: string): RegExp {
  const body = pattern
    .split('/')
    .map((segment) => {
      if (/^\[\.\.\..+\]$/.test(segment)) return '.+';
      if (/^\[.+\]$/.test(segment)) return '[^/]+';
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return new RegExp(`^${body}$`);
}

const PATTERN_MATCHERS = ROUTE_PATTERNS.map((pattern) => ({
  pattern,
  re: patternToRegExp(pattern),
}));

const matchingPatterns = (url: string): string[] =>
  PATTERN_MATCHERS.filter(({ re }) => re.test(url)).map(({ pattern }) => pattern);

// ---------------------------------------------------------------------------
// The value under test (captured once; determinism is asserted separately)
// ---------------------------------------------------------------------------

const routes = listSiteRoutes();

// ---------------------------------------------------------------------------

describe('listSiteRoutes — property invariants', () => {
  it('produces a non-empty enumerable set (vacuity guard for every property below)', () => {
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    // If the filesystem walk found nothing, the containment properties would
    // pass vacuously. Guard both sides of the round trip.
    expect(ASTRO_PAGE_FILES.length).toBeGreaterThan(0);
    expect(STATIC_PATTERNS.length).toBeGreaterThan(0);
    expect(DYNAMIC_PATTERNS.length).toBeGreaterThan(0);
  });

  // -- shape ---------------------------------------------------------------

  it('every element is an absolute, trailing-slashed path with no empty or whitespace segments', () => {
    // `/` matches (zero segments); `/a/`, `/a/b/` match; `/a`, `a/`, `//`,
    // `/a//b/`, `/a/ b/` and any absolute URL do not.
    const shape = /^\/(?:[^/\s]+\/)*$/;
    for (const url of routes) {
      expect(typeof url, `not a string: ${JSON.stringify(url)}`).toBe('string');
      expect(shape.test(url), `bad path shape: ${JSON.stringify(url)}`).toBe(true);
    }
  });

  it('`/` is the landing page and the only single-slash element', () => {
    for (const url of routes) {
      if (url.length === 1) {
        expect(url, `single-character element that is not "/": ${JSON.stringify(url)}`).toBe('/');
      }
    }
    expect(routes.filter((url) => url === '/')).toEqual(['/']);
  });

  it('no element carries a query string, fragment, scheme, or host', () => {
    for (const url of routes) {
      for (const forbidden of ['?', '#', '://', '\\']) {
        expect(url.includes(forbidden), `element ${JSON.stringify(url)} contains ${forbidden}`).toBe(
          false,
        );
      }
      expect(url.startsWith('//'), `protocol-relative element: ${JSON.stringify(url)}`).toBe(false);
    }
  });

  // -- injectivity ---------------------------------------------------------

  it('never returns a duplicate path', () => {
    const seen = new Map<string, number>();
    for (const url of routes) seen.set(url, (seen.get(url) ?? 0) + 1);
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([url, n]) => `${url} x${n}`);
    expect(duplicates).toEqual([]);
    expect(new Set(routes).size).toBe(routes.length);
  });

  // -- placeholder expansion ----------------------------------------------

  it('no element contains an unexpanded `[param]` placeholder', () => {
    for (const url of routes) {
      expect(url.includes('['), `unexpanded placeholder in ${JSON.stringify(url)}`).toBe(false);
      expect(url.includes(']'), `unexpanded placeholder in ${JSON.stringify(url)}`).toBe(false);
      // A percent-encoded bracket is still an unexpanded placeholder.
      expect(/%5b|%5d/i.test(url), `encoded placeholder in ${JSON.stringify(url)}`).toBe(false);
    }
  });

  it('every element is directly usable as a sitemap `<loc>` path (no segment is a literal param name)', () => {
    const paramNames = new Set(
      DYNAMIC_PATTERNS.flatMap((pattern) =>
        pattern
          .split('/')
          .filter((segment) => /^\[.*\]$/.test(segment))
          .map((segment) => segment.replace(/^\[(?:\.\.\.)?/, '').replace(/\]$/, '')),
      ),
    );
    expect(paramNames.size).toBeGreaterThan(0);
    for (const url of routes) {
      for (const segment of url.split('/')) {
        if (segment === '') continue;
        expect(
          paramNames.has(segment),
          `element ${JSON.stringify(url)} still contains the raw param name "${segment}"`,
        ).toBe(false);
      }
    }
  });

  // -- determinism / idempotence -------------------------------------------

  it('returns an equal list on repeated calls (deep equality, order included)', () => {
    const a = listSiteRoutes();
    const b = listSiteRoutes();
    expect(a).toEqual(b);
    expect(b).toEqual(routes);
    // Idempotent as a set operation too: calling it again neither adds nor
    // drops anything.
    expect(new Set(b).size).toBe(new Set(routes).size);
  });

  it('does not hand callers a shared mutable array (a mutated result does not corrupt the next call)', () => {
    const first = listSiteRoutes();
    first.push('/definitely-not-a-real-page/');
    first[0] = '/mutated/';
    const second = listSiteRoutes();
    expect(second).toEqual(routes);
  });

  // -- ordering ------------------------------------------------------------

  it('places `/` first and keeps the remainder in an order that is stable across calls', () => {
    expect(routes[0]).toBe('/');
    const again = listSiteRoutes();
    expect(again[0]).toBe('/');
    expect(again.slice(1)).toEqual(routes.slice(1));
  });

  it('is sorted (facade: "trailing-slashed, sorted, and deduplicated")', () => {
    // The facade says "sorted" without naming a comparator, so the invariant
    // is: the list is in ascending order under a standard string comparator.
    // Code-unit order and locale order disagree on punctuation (`-` vs `/`),
    // and the spec does not pin one, so either satisfies the contract.
    const firstInversion = (cmp: (a: string, b: string) => number): string | null => {
      for (let i = 1; i < routes.length; i += 1) {
        if (cmp(routes[i - 1], routes[i]) > 0) return `${routes[i - 1]} > ${routes[i]} (index ${i})`;
      }
      return null;
    };
    const codeUnit = firstInversion((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const locale = firstInversion((a, b) => a.localeCompare(b));
    expect(
      codeUnit === null || locale === null,
      `not sorted: code-unit inversion at ${codeUnit}; locale inversion at ${locale}`,
    ).toBe(true);
  });

  // -- containment: output -> filesystem -----------------------------------

  it('every element corresponds to a real routable page under src/pages/', () => {
    for (const url of routes) {
      const matches = matchingPatterns(url);
      expect(
        matches.length,
        `element ${JSON.stringify(url)} matches no route pattern under src/pages/ ` +
          `(known patterns: ${ROUTE_PATTERNS.join(', ')})`,
      ).toBeGreaterThan(0);
    }
  });

  // -- containment: filesystem -> output -----------------------------------

  it('every static (non-`[param]`) route file under src/pages/ has a corresponding element', () => {
    // Precondition: the facade limits routes to `.astro` pages. If a `.md` /
    // `.mdx` page ever lands under src/pages/, Astro would route it and this
    // walk would be incomplete, so fail loudly rather than silently under-check.
    const markdownPages = PAGE_DIR_FILES.filter((f) => /\.mdx?$/.test(f));
    expect(markdownPages, 'markdown pages under src/pages/ are not covered by this walk').toEqual(
      [],
    );

    const missing = STATIC_PATTERNS.filter((pattern) => !routes.includes(pattern));
    expect(missing, `static pages missing from listSiteRoutes(): ${missing.join(', ')}`).toEqual([]);
  });

  it('every `src/pages/research/*.astro` article except index has a `/research/<slug>/` element', () => {
    // The regression that motivated the unit: four of five research articles
    // were absent from every discovery surface.
    const articles = ASTRO_PAGE_FILES.filter(
      (f) => f.startsWith('research/') && f !== 'research/index.astro' && !f.includes('['),
    ).map((f) => `/research/${path.basename(f, '.astro')}/`);
    expect(articles.length).toBeGreaterThan(1);
    for (const url of articles) {
      expect(routes.includes(url), `missing research article route: ${url}`).toBe(true);
    }
  });

  it('includes every static page the spec names by hand', () => {
    // Cross-check on the filesystem walk itself: if the walk silently stopped
    // recursing, the property above would pass while the site lost pages.
    for (const url of [
      '/',
      '/badge/',
      '/badge/how-to-embed/',
      '/leaderboard/',
      '/research/',
      '/scorecards/',
      '/scorecards/scoring/',
      '/spec/',
      '/glossary/',
      '/press/',
      '/privacy/',
      '/release-notes/',
      '/chrome-extension/',
    ]) {
      expect(routes.includes(url), `missing spec-named static page: ${url}`).toBe(true);
    }
  });

  // -- containment: data loaders -> output ---------------------------------

  it('includes `/scorecards/<version>/`, `.../changes/`, and `.../checks/<id>/` for every scorecard', () => {
    const versions = listAllScorecards().map((card) => card.version);
    expect(versions.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const version of versions) {
      for (const url of [`/scorecards/${version}/`, `/scorecards/${version}/changes/`]) {
        if (!routes.includes(url)) missing.push(url);
      }
      const scorecard = getScorecardByVersion(version);
      const checkIds = [
        ...scorecard.siteChecks.map((check) => check.id),
        ...scorecard.pageChecks.map((check) => check.id),
      ];
      expect(checkIds.length, `scorecard ${version} declares no checks`).toBeGreaterThan(0);
      for (const id of checkIds) {
        const url = `/scorecards/${version}/checks/${id}/`;
        if (!routes.includes(url)) missing.push(url);
      }
    }
    expect(missing, `scorecard routes missing from listSiteRoutes(): ${missing.join(', ')}`).toEqual(
      [],
    );
  });

  it('every `/scorecards/<version>/...` element names a real scorecard version', () => {
    const versions = new Set(listAllScorecards().map((card) => card.version));
    for (const url of routes) {
      const match = /^\/scorecards\/([^/]+)\//.exec(url);
      if (!match) continue;
      const segment = match[1];
      // `/scorecards/scoring/...` is a sibling static route, not a version.
      if (segment === 'scoring') continue;
      expect(
        versions.has(segment),
        `element ${JSON.stringify(url)} announces unknown scorecard version "${segment}"`,
      ).toBe(true);
    }
  });

  it('announces `/leaderboard/<slug>/` for exactly the leaderboard entries with a published run', () => {
    const published = new Set(listSiteRunSlugs());
    const entries = getLeaderboard();
    expect(entries.length).toBeGreaterThan(0);

    const announced = new Set(
      routes
        .map((url) => /^\/leaderboard\/([^/]+)\/$/.exec(url))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => m[1]),
    );

    const missing = entries
      .filter((entry) => published.has(entry.slug))
      .map((entry) => entry.slug)
      .filter((slug) => !announced.has(slug));
    expect(missing, `published leaderboard slugs missing from output: ${missing.join(', ')}`).toEqual(
      [],
    );

    const unpublished = entries
      .filter((entry) => !published.has(entry.slug))
      .map((entry) => entry.slug)
      .filter((slug) => announced.has(slug));
    expect(
      unpublished,
      `unpublished leaderboard slugs announced (these URLs 404): ${unpublished.join(', ')}`,
    ).toEqual([]);

    // Nothing under /leaderboard/ that is not a published run slug.
    for (const slug of announced) {
      expect(published.has(slug), `/leaderboard/${slug}/ has no published site run`).toBe(true);
    }
  });

  // -- exclusion -----------------------------------------------------------

  it('excludes the `/scorecards/draft/` alias and everything beneath it', () => {
    for (const url of routes) {
      expect(
        /^\/scorecards\/draft\//.test(url),
        `draft alias leaked into discovery: ${JSON.stringify(url)}`,
      ).toBe(false);
    }
  });
});
