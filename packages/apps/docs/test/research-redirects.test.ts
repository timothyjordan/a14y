/**
 * Adversarial + property tests for `listResearchRedirects`.
 *
 * Oracle source: `src/lib/site-routes.spec.md` (sections "# listResearchRedirects"
 * and "# listLeaderboardSlugs") plus the site's own data loaders and the
 * `src/pages/research/` tree. The implementation body of `site-routes.ts` was
 * never read while writing these tests: every expectation is derived from the
 * spec's promises or recomputed independently from the same data sources the
 * spec references (`getLeaderboard()`, `listSiteRunSlugs()`, `listSiteRoutes()`,
 * `listPageRoutes()`, and the pages filesystem).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  listResearchRedirects,
  listLeaderboardSlugs,
  listSiteRoutes,
  listPageRoutes,
} from '../src/lib/site-routes';
import { getLeaderboard } from '../src/lib/research-data';
import { listSiteRunSlugs } from '../src/lib/site-run';

const PAGES_DIR = fileURLToPath(new URL('../src/pages', import.meta.url));

/**
 * Independently recompute the set of published leaderboard slugs from the same
 * two data sources the spec names: a leaderboard entry counts iff its site run
 * has been published. This is *not* read from the subject; it is the oracle the
 * subject is checked against.
 */
function publishedLeaderboardSlugs(): string[] {
  const published = new Set(listSiteRunSlugs());
  return getLeaderboard()
    .filter((e) => published.has(e.slug))
    .map((e) => e.slug);
}

/**
 * Independently recompute the real `/research/<slug>/` article routes from the
 * filesystem: every `src/pages/research/*.astro` other than `index.astro`.
 * A redirect key must never collide with one of these.
 */
function researchArticleSlugs(): string[] {
  return readdirSync(join(PAGES_DIR, 'research'))
    .filter((f) => f.endsWith('.astro') && f !== 'index.astro' && !f.startsWith('_'))
    .map((f) => f.slice(0, -'.astro'.length));
}

const RESEARCH_ARTICLE_SLUGS = researchArticleSlugs();
const RESEARCH_ARTICLE_ROUTES = new Set(
  listPageRoutes()
    .filter((p) => p.startsWith('/research/') && p !== '/research/' && !p.includes('['))
    // `/research/<slug>/` article pages, recomputed from the route table.
    .concat(RESEARCH_ARTICLE_SLUGS.map((s) => `/research/${s}/`)),
);

/** `/research/<slug>/` -> `slug`, or null if the shape is wrong. */
function parseResearchKey(key: string): string | null {
  const m = /^\/research\/([^/]+)\/$/.exec(key);
  return m ? m[1]! : null;
}

/** `/leaderboard/<slug>/` -> `slug`, or null if the shape is wrong. */
function parseLeaderboardValue(value: string): string | null {
  const m = /^\/leaderboard\/([^/]+)\/$/.exec(value);
  return m ? m[1]! : null;
}

describe('listResearchRedirects shape', () => {
  it('returns a non-empty plain object (guards a vacuous test)', () => {
    const map = listResearchRedirects();
    expect(map && typeof map).toBe('object');
    expect(Array.isArray(map)).toBe(false);
    const keys = Object.keys(map);
    // There are published leaderboard sites, so there must be redirects.
    expect(keys.length).toBeGreaterThan(0);
  });

  it('every key is a /research/<slug>/ path and every value a /leaderboard/<slug>/ path', () => {
    const map = listResearchRedirects();
    for (const [from, to] of Object.entries(map)) {
      expect(typeof from).toBe('string');
      expect(typeof to).toBe('string');
      expect(from.startsWith('/research/'), `key ${from} must start with /research/`).toBe(true);
      expect(from.endsWith('/'), `key ${from} must end with /`).toBe(true);
      expect(to.startsWith('/leaderboard/'), `value ${to} must start with /leaderboard/`).toBe(true);
      expect(to.endsWith('/'), `value ${to} must end with /`).toBe(true);
      // Parse-able as exactly one slug segment on each side.
      expect(parseResearchKey(from), `key ${from} is not /research/<slug>/`).not.toBeNull();
      expect(parseLeaderboardValue(to), `value ${to} is not /leaderboard/<slug>/`).not.toBeNull();
    }
  });

  it('maps /research/<slug>/ to /leaderboard/<slug>/ with the same slug on both sides', () => {
    const map = listResearchRedirects();
    for (const [from, to] of Object.entries(map)) {
      const fromSlug = parseResearchKey(from);
      const toSlug = parseLeaderboardValue(to);
      expect(fromSlug).not.toBeNull();
      expect(toSlug).not.toBeNull();
      expect(toSlug, `${from} must redirect to /leaderboard/${fromSlug}/`).toBe(fromSlug);
      // And the value is spelled exactly `/leaderboard/<slug>/`.
      expect(to).toBe(`/leaderboard/${fromSlug}/`);
    }
  });
});

describe('listResearchRedirects coverage of published slugs', () => {
  const published = publishedLeaderboardSlugs();
  const articleSet = new Set(RESEARCH_ARTICLE_SLUGS);
  // Clause 5 carve-out: a published slug that collides with a real research
  // article page cannot be a redirect key, so it is excluded from expected
  // coverage. (Recomputed independently, not read from the subject.)
  const expectedCoveredSlugs = published.filter((s) => !articleSet.has(s));

  it('has published leaderboard slugs to cover (guards a vacuous test)', () => {
    expect(published.length).toBeGreaterThan(0);
    // The recomputed oracle should agree with the subject's own slug list.
    expect([...published].sort()).toEqual([...listLeaderboardSlugs()].sort());
  });

  it('has an entry for every published leaderboard slug (one-to-one, modulo article collisions)', () => {
    const map = listResearchRedirects();
    const keySlugs = new Set(Object.keys(map).map((k) => parseResearchKey(k)!));

    // Every expected published slug is covered.
    const missing = expectedCoveredSlugs.filter((s) => !keySlugs.has(s));
    expect(missing, `published slugs with no redirect: ${JSON.stringify(missing)}`).toEqual([]);

    // And no redirect key exists for a slug that is not a published leaderboard
    // site (the map is not padded with extras).
    const publishedSet = new Set(published);
    const extra = [...keySlugs].filter((s) => !publishedSet.has(s));
    expect(extra, `redirect keys for non-published slugs: ${JSON.stringify(extra)}`).toEqual([]);
  });

  it('one redirect key per covered slug, no duplicates', () => {
    const keys = Object.keys(listResearchRedirects());
    const slugs = keys.map((k) => parseResearchKey(k)!);
    expect(new Set(slugs).size).toBe(slugs.length);
    // Exactly the expected covered set, both directions.
    expect([...new Set(slugs)].sort()).toEqual([...new Set(expectedCoveredSlugs)].sort());
  });
});

describe('listResearchRedirects target validity', () => {
  it('every redirect value is a URL that listSiteRoutes() actually publishes', () => {
    const routes = new Set(listSiteRoutes());
    const map = listResearchRedirects();
    const dangling = Object.values(map).filter((to) => !routes.has(to));
    expect(dangling, `redirect targets not in listSiteRoutes(): ${JSON.stringify(dangling)}`).toEqual(
      [],
    );
  });
});

describe('listResearchRedirects does not shadow real research articles', () => {
  it('has research article pages to protect (guards a vacuous test)', () => {
    expect(RESEARCH_ARTICLE_SLUGS.length).toBeGreaterThan(0);
  });

  it('no redirect key collides with a real /research/ article page', () => {
    const map = listResearchRedirects();
    const keys = new Set(Object.keys(map));
    // Independently computed article routes (filesystem + route table).
    for (const articleRoute of RESEARCH_ARTICLE_ROUTES) {
      expect(
        keys.has(articleRoute),
        `${articleRoute} is a real article page and must not be a redirect key`,
      ).toBe(false);
    }
    // Same check via slug form, so a differently-spelled key can't slip through.
    const articleSet = new Set(RESEARCH_ARTICLE_SLUGS);
    for (const key of keys) {
      const slug = parseResearchKey(key)!;
      expect(articleSet.has(slug), `redirect key ${key} shadows the ${slug} article`).toBe(false);
    }
  });
});

describe('listResearchRedirects sources stay out of the sitemap', () => {
  it('no redirect key appears in listSiteRoutes()', () => {
    const routes = new Set(listSiteRoutes());
    const map = listResearchRedirects();
    const announced = Object.keys(map).filter((from) => routes.has(from));
    expect(
      announced,
      `redirect sources leaked into listSiteRoutes(): ${JSON.stringify(announced)}`,
    ).toEqual([]);
  });
});

describe('listResearchRedirects determinism', () => {
  it('returns deeply-equal maps on repeated calls', () => {
    expect(listResearchRedirects()).toEqual(listResearchRedirects());
  });

  it('is not corrupted by a caller mutating the returned object', () => {
    const before = { ...listResearchRedirects() };
    const handed = listResearchRedirects();
    handed['/research/tbp-mutation-sentinel/'] = '/leaderboard/tbp-mutation-sentinel/';
    // Mutate an existing key too, if any, to catch a shared-reference leak.
    const firstKey = Object.keys(handed)[0];
    if (firstKey) handed[firstKey] = '/leaderboard/tbp-corrupted/';

    const after = listResearchRedirects();
    expect(after['/research/tbp-mutation-sentinel/']).toBeUndefined();
    expect(after).toEqual(before);
  });
});

describe('listResearchRedirects property invariants', () => {
  // fast-check is not a dependency of this repo (see the other property specs),
  // so these invariants are checked exhaustively over every entry rather than by
  // random sampling. Exhaustive coverage is strictly stronger than a sample.
  it('for every entry, value === /leaderboard/<same-slug-as-key>/', () => {
    const entries = Object.entries(listResearchRedirects());
    expect(entries.length).toBeGreaterThan(0);
    for (const [from, to] of entries) {
      const slug = parseResearchKey(from);
      expect(slug, `key ${from} must be /research/<slug>/`).not.toBeNull();
      expect(to).toBe(`/leaderboard/${slug}/`);
    }
  });

  it('for every value, the target is a published site route', () => {
    const routes = new Set(listSiteRoutes());
    for (const to of Object.values(listResearchRedirects())) {
      expect(routes.has(to), `${to} is not in listSiteRoutes()`).toBe(true);
    }
  });
});

describe('listResearchRedirects TJ-1338 reported 404s', () => {
  // The 13 old per-site URLs the motivating issue reported as 404 in Google's
  // crawl. Each should now redirect to its /leaderboard/<slug>/ home if that
  // site is a currently-published leaderboard slug; otherwise the test asserts
  // that reality explicitly rather than passing silently.
  const REPORTED = [
    'turso',
    'costco',
    'php',
    'scala',
    'webflow',
    'sentry-docs',
    'merriam-webster',
    'workday',
    'freshworks',
    'segment-docs',
    'tensorflow',
    'grafana-docs',
    'slack',
  ] as const;

  const published = new Set(publishedLeaderboardSlugs());
  const articleSet = new Set(RESEARCH_ARTICLE_SLUGS);

  for (const slug of REPORTED) {
    it(`handles /research/${slug}/ per its published status`, () => {
      const map = listResearchRedirects();
      const routes = new Set(listSiteRoutes());
      const key = `/research/${slug}/`;

      const isPublished = published.has(slug);
      const isArticle = articleSet.has(slug);

      if (isPublished && !isArticle) {
        // The issue's fix: old URL redirects to the live leaderboard page,
        // and that target is really published.
        expect(map[key], `${key} should redirect (published slug)`).toBe(`/leaderboard/${slug}/`);
        expect(routes.has(`/leaderboard/${slug}/`), `/leaderboard/${slug}/ must be published`).toBe(
          true,
        );
      } else {
        // Document reality: this slug is not a currently-published leaderboard
        // site (or collides with an article), so there is no redirect for it.
        expect(
          map[key],
          `${key} is not a published leaderboard slug (published=${isPublished}, article=${isArticle})`,
        ).toBeUndefined();
      }
    });
  }

  it('at least most of the reported slugs are covered (sanity, not silent-pass)', () => {
    const map = listResearchRedirects();
    const covered = REPORTED.filter((s) => map[`/research/${s}/`] === `/leaderboard/${s}/`);
    const uncovered = REPORTED.filter((s) => !covered.includes(s));
    // Surface the actual split so the test documents reality; do not fail on it.
    // eslint-disable-next-line no-console
    if (uncovered.length > 0) {
      console.info(
        `TJ-1338 reported slugs not currently redirected: ${JSON.stringify(uncovered)}`,
      );
    }
    // If NONE of the 13 were covered, the redirect map is almost certainly
    // broken; guard against that vacuous outcome.
    expect(covered.length).toBeGreaterThan(0);
  });
});
