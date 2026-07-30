/**
 * Adversarial tests for `listSiteRoutes` / `listPageRoutes`.
 *
 * Oracle source: `src/lib/site-routes.spec.md` (via the testbotpro request)
 * plus the site's own data loaders and the `src/pages/` tree. The
 * implementation file was never read while writing these tests, so nothing
 * here asserts "what the code currently does" — every expectation is derived
 * from the spec's promises or recomputed independently from the filesystem
 * and the loaders the routes themselves use.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listPageRoutes, listSiteRoutes } from '../src/lib/site-routes';

import {
  getCheckSummariesForScorecard,
  getCheckSummary,
  listAllScorecards,
} from '../src/lib/scorecard-data';
import { getLeaderboard } from '../src/lib/research-data';
import { listSiteRunSlugs } from '../src/lib/site-run';

const PAGES_DIR = fileURLToPath(new URL('../src/pages', import.meta.url));

/** The subject's public surface, for the freshly-imported copy used below. */
interface Subject {
  listSiteRoutes(): string[];
  listPageRoutes(): string[];
}

/**
 * Independently derive Astro's route patterns from `src/pages/`, using only
 * Astro's documented file-routing rules:
 *   index.astro         -> the directory's own path
 *   <name>.astro        -> /<name>/
 *   <dir>/              -> nested prefix
 *   _-prefixed          -> not a route (Astro's private-file convention)
 *   non-.astro          -> not a route (endpoints / colocated files)
 * Dynamic segments are left in their `[param]` form so the caller can tell
 * patterns from concrete paths.
 */
function walkRoutePatterns(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) {
      out.push(...walkRoutePatterns(join(dir, entry.name), `${prefix}${entry.name}/`));
      continue;
    }
    if (!entry.name.endsWith('.astro')) continue;
    const base = entry.name.slice(0, -'.astro'.length);
    out.push(base === 'index' ? `/${prefix}` : `/${prefix}${base}/`);
  }
  return out;
}

const routePatterns = walkRoutePatterns(PAGES_DIR);
const staticPatterns = routePatterns.filter((p) => !p.includes('['));
const dynamicPatterns = routePatterns.filter((p) => p.includes('['));

/** `/scorecards/[version]/checks/[id]/` -> /^\/scorecards\/([^/]+)\/checks\/([^/]+)\/$/ */
function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((segment) => {
      if (segment === '') return '';
      if (!segment.includes('[')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // A segment may mix literals and params; only `[param]` is a wildcard.
      return segment
        .split(/(\[[^\]]+\])/)
        .filter(Boolean)
        .map((part) =>
          part.startsWith('[') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('');
    })
    .join('/');
  return new RegExp(`^${source}$`);
}

describe('listPageRoutes', () => {
  it('mirrors the src/pages tree exactly, patterns and all', () => {
    // Derived from the filesystem, not from a hand-kept list: if a page is
    // added or removed, both sides of this assertion move together. The
    // whole point of the unit is that the route table is not restated.
    expect([...listPageRoutes()].sort()).toEqual([...routePatterns].sort());
  });

  it('returns no duplicates', () => {
    const patterns = listPageRoutes();
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('returns only absolute, trailing-slashed patterns', () => {
    for (const pattern of listPageRoutes()) {
      expect(pattern.startsWith('/')).toBe(true);
      expect(pattern.endsWith('/')).toBe(true);
      expect(pattern).not.toContain('//');
      expect(pattern).not.toContain('.astro');
    }
  });

  it('still reports the dynamic routes as patterns (they are not pre-expanded here)', () => {
    // Guards against listPageRoutes quietly dropping dynamic routes, which
    // would make the "throw on an unregistered [param]" contract unreachable.
    expect(dynamicPatterns.length).toBeGreaterThan(0);
    const reported = listPageRoutes();
    for (const pattern of dynamicPatterns) {
      expect(reported).toContain(pattern);
    }
  });
});

describe('listSiteRoutes shape invariants', () => {
  it('returns a non-empty string[]', () => {
    const routes = listSiteRoutes();
    expect(Array.isArray(routes)).toBe(true);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) expect(typeof route).toBe('string');
  });

  it('never returns an unexpanded [ or ] in any path', () => {
    // The regression that would ship `/scorecards/[version]/` straight into
    // a <loc>. Checked on every element, not a sample.
    const offenders = listSiteRoutes().filter((r) => r.includes('[') || r.includes(']'));
    expect(offenders).toEqual([]);
  });

  it('returns only absolute, trailing-slashed paths', () => {
    for (const route of listSiteRoutes()) {
      expect(route.startsWith('/')).toBe(true);
      expect(route.endsWith('/')).toBe(true);
      expect(route).not.toContain('//');
      expect(route).not.toMatch(/\s/);
      expect(route).not.toContain('?');
      expect(route).not.toContain('#');
      expect(route).not.toContain('\\');
    }
  });

  it('includes the landing page as exactly "/" and puts it first', () => {
    const routes = listSiteRoutes();
    expect(routes).toContain('/');
    expect(routes[0]).toBe('/');
  });

  it('never returns a duplicate path', () => {
    const routes = listSiteRoutes();
    const seen = new Map<string, number>();
    for (const route of routes) seen.set(route, (seen.get(route) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([r]) => r);
    expect(dupes).toEqual([]);
  });

  it('is safe to concatenate onto an origin', () => {
    // A <loc> is built by string concatenation; anything that re-parses to a
    // different path (encoded segments, dot segments) is a silent 404.
    for (const route of listSiteRoutes()) {
      const url = new URL(route, 'https://a14y.dev');
      expect(url.pathname).toBe(route);
    }
  });

  it('returns an equal list on repeated calls', () => {
    expect(listSiteRoutes()).toEqual(listSiteRoutes());
  });

  it('is not corrupted by a caller mutating a previously returned array', () => {
    // "Return an equal list on repeated calls" has to survive a caller that
    // treats the result as its own, which a memoised-and-shared array would
    // not.
    const before = [...listSiteRoutes()];
    const handed = listSiteRoutes();
    handed.push('/tbp-mutation-sentinel/');
    const after = listSiteRoutes();
    expect(after).not.toContain('/tbp-mutation-sentinel/');
    expect(after).toEqual(before);
  });

  it('orders everything after "/" deterministically and sorted', () => {
    const rest = listSiteRoutes().slice(1);
    const codeUnitOrder = [...rest].sort();
    const localeOrder = [...rest].sort((a, b) => a.localeCompare(b));
    // The façade promises "sorted" without naming a collation, so either of
    // the two plausible comparators passes; an unsorted or unstable order
    // fails.
    const sorted =
      rest.join('\n') === codeUnitOrder.join('\n') || rest.join('\n') === localeOrder.join('\n');
    expect(sorted).toBe(true);
  });
});

describe('listSiteRoutes static pages', () => {
  it('includes every static page found under src/pages/', () => {
    const routes = new Set(listSiteRoutes());
    const missing = staticPatterns.filter((p) => !routes.has(p));
    expect(missing).toEqual([]);
  });

  it('includes each page the spec names explicitly', () => {
    // Straight from the spec's "Should" list. These are the pages that were
    // live-and-unannounced before this unit existed.
    const routes = listSiteRoutes();
    for (const path of [
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
      expect(routes).toContain(path);
    }
  });

  it('does not invent a page that has no file under src/pages/', () => {
    // Every returned path must be explainable by some route pattern in the
    // pages tree. A path matching nothing is a URL nobody serves.
    const matchers = routePatterns.map(patternToRegExp);
    const unexplained = listSiteRoutes().filter((route) => !matchers.some((re) => re.test(route)));
    expect(unexplained).toEqual([]);
  });

  it('expands every dynamic pattern into at least one concrete path', () => {
    // A silently-empty expander is the same drift failure as a hardcoded
    // list, just with fewer symptoms.
    const routes = listSiteRoutes();
    for (const pattern of dynamicPatterns) {
      const re = patternToRegExp(pattern);
      expect(
        routes.some((route) => re.test(route)),
        `no concrete path was emitted for ${pattern}`,
      ).toBe(true);
    }
  });
});

describe('listSiteRoutes research articles (the original regression)', () => {
  const researchArticles = readdirSync(join(PAGES_DIR, 'research'))
    .filter((f) => f.endsWith('.astro') && f !== 'index.astro' && !f.startsWith('_'))
    .map((f) => f.slice(0, -'.astro'.length));

  it('has research articles to announce (guards a vacuous test)', () => {
    expect(researchArticles.length).toBeGreaterThan(0);
  });

  it('includes /research/<slug>/ for every research article file', () => {
    const routes = listSiteRoutes();
    for (const slug of researchArticles) {
      expect(routes).toContain(`/research/${slug}/`);
    }
  });

  it('announces exactly the research pages that exist, no more', () => {
    const expected = new Set(['/research/', ...researchArticles.map((s) => `/research/${s}/`)]);
    const actual = listSiteRoutes().filter((r) => r.startsWith('/research/') || r === '/research/');
    expect([...new Set(actual)].sort()).toEqual([...expected].sort());
  });
});

describe('listSiteRoutes leaderboard slugs', () => {
  const published = new Set(listSiteRunSlugs());
  const entries = getLeaderboard();
  const expectedSlugs = entries.filter((e) => published.has(e.slug)).map((e) => e.slug);

  it('has published leaderboard runs to announce (guards a vacuous test)', () => {
    expect(expectedSlugs.length).toBeGreaterThan(0);
  });

  it('announces exactly the leaderboard entries whose site run is published', () => {
    // Same filter the route's own getStaticPaths applies. Anything extra is
    // an announced 404; anything missing is an unlisted live page.
    const expected = new Set([
      '/leaderboard/',
      ...expectedSlugs.map((slug) => `/leaderboard/${slug}/`),
    ]);
    const actual = listSiteRoutes().filter((r) => r.startsWith('/leaderboard/'));
    expect([...new Set(actual)].sort()).toEqual([...expected].sort());
  });

  it('announces no leaderboard slug without a published site run', () => {
    const unpublished = entries.filter((e) => !published.has(e.slug)).map((e) => e.slug);
    const routes = new Set(listSiteRoutes());
    for (const slug of unpublished) {
      expect(routes.has(`/leaderboard/${slug}/`)).toBe(false);
    }
  });

  it('every announced leaderboard slug resolves to a published run', () => {
    // Reverse direction, so a slug source unrelated to getLeaderboard()
    // (say, the raw runs directory or a stale JSON index) still has to
    // satisfy the "published run" rule.
    const announced = listSiteRoutes()
      .filter((r) => r.startsWith('/leaderboard/') && r !== '/leaderboard/')
      .map((r) => r.slice('/leaderboard/'.length, -1));
    const known = new Set(entries.map((e) => e.slug));
    for (const slug of announced) {
      expect(slug).not.toContain('/');
      expect(published.has(slug), `${slug} has no published site run`).toBe(true);
      expect(known.has(slug), `${slug} is not a leaderboard entry`).toBe(true);
    }
  });
});

describe('listSiteRoutes scorecards', () => {
  const scorecards = listAllScorecards();

  it('has scorecards to announce (guards a vacuous test)', () => {
    expect(scorecards.length).toBeGreaterThan(0);
  });

  it('includes /scorecards/<version>/ and /changes/ for every registered scorecard', () => {
    const routes = new Set(listSiteRoutes());
    for (const card of scorecards) {
      expect(routes.has(`/scorecards/${card.version}/`), `missing overview for ${card.version}`).toBe(
        true,
      );
      expect(routes.has(`/scorecards/${card.version}/changes/`), `missing changes for ${card.version}`).toBe(
        true,
      );
    }
  });

  it('includes a checks page for every check id in every scorecard', () => {
    const routes = new Set(listSiteRoutes());
    const missing: string[] = [];
    for (const card of scorecards) {
      for (const check of getCheckSummariesForScorecard(card.version)) {
        const path = `/scorecards/${card.version}/checks/${check.id}/`;
        if (!routes.has(path)) missing.push(path);
      }
    }
    expect(missing).toEqual([]);
  });

  it('announces no check page for a check that scorecard does not contain', () => {
    // Guards a cross-product expander: every id crossed with every version
    // would announce a pile of URLs the route never builds.
    const bogus: string[] = [];
    for (const route of listSiteRoutes()) {
      const match = /^\/scorecards\/([^/]+)\/checks\/([^/]+)\/$/.exec(route);
      if (!match) continue;
      const [, version, id] = match;
      if (getCheckSummary(version!, id!) === null) bogus.push(route);
    }
    expect(bogus).toEqual([]);
  });

  it('announces no scorecard version that is not registered', () => {
    const known = new Set(scorecards.map((c) => c.version));
    const unknown = listSiteRoutes()
      .filter((r) => r.startsWith('/scorecards/'))
      .map((r) => /^\/scorecards\/([^/]+)\//.exec(r)?.[1])
      .filter((v): v is string => Boolean(v))
      // `/scorecards/scoring/...` is its own page tree, not a version.
      .filter((v) => v !== 'scoring')
      .filter((v) => !known.has(v));
    expect([...new Set(unknown)]).toEqual([]);
  });
});

describe('listSiteRoutes /scorecards/draft/ alias exclusion', () => {
  it('excludes the /scorecards/draft/ alias and everything beneath it', () => {
    // The alias renders byte-identical content to the current -draft
    // version. Announcing both publishes duplicate pages.
    const leaked = listSiteRoutes().filter(
      (r) => r === '/scorecards/draft/' || r.startsWith('/scorecards/draft/'),
    );
    expect(leaked).toEqual([]);
  });

  it('still announces the real -draft version pages', () => {
    // The exclusion must be the literal `draft` segment, not a substring
    // match on "draft": an over-broad filter would drop the genuine
    // `/scorecards/<x.y.z>-draft/` pages, which are canonical.
    const draftCards = listAllScorecards().filter((c) => c.version.endsWith('-draft'));
    if (draftCards.length === 0) return; // no draft registered; nothing to prove
    const routes = new Set(listSiteRoutes());
    for (const card of draftCards) {
      expect(routes.has(`/scorecards/${card.version}/`)).toBe(true);
      expect(routes.has(`/scorecards/${card.version}/changes/`)).toBe(true);
    }
  });
});

describe('listSiteRoutes unregistered dynamic route', () => {
  // Probing this claim needs a real page file, because the unit takes no
  // arguments and reads `src/pages/` directly. The directory name avoids a
  // leading underscore on purpose: Astro treats `_`-prefixed paths as
  // non-routes, so an underscored probe would prove nothing.
  const probeDir = join(PAGES_DIR, 'tbp-probe-unregistered');
  const probeFile = join(probeDir, '[tbpUnknownParam].astro');

  afterEach(() => {
    rmSync(probeDir, { recursive: true, force: true });
  });

  it('throws, naming the offending route pattern', async () => {
    mkdirSync(dirname(probeFile), { recursive: true });
    writeFileSync(probeFile, '<p>testbotpro probe page</p>\n', 'utf8');
    expect(existsSync(probeFile)).toBe(true);

    // Fresh module instance so any memoised route list cannot mask the
    // newly added page.
    vi.resetModules();
    const fresh = (await import('../src/lib/site-routes')) as unknown as Subject;

    let thrown: unknown = null;
    let returned: string[] | null = null;
    try {
      returned = fresh.listSiteRoutes();
    } catch (caught) {
      thrown = caught;
    }

    expect(
      thrown,
      `expected a throw for the unregistered [tbpUnknownParam] route; instead got ` +
        `${returned?.length ?? 0} routes (probe-matching: ` +
        `${JSON.stringify((returned ?? []).filter((r) => r.includes('tbp-probe')))})`,
    ).not.toBeNull();

    const message = thrown instanceof Error ? thrown.message : String(thrown);
    // The message has to identify the route, not just say "unknown param":
    // a partial list plus a vague error is the drift this unit prevents.
    expect(message).toContain('tbp-probe-unregistered');
    expect(message).toContain('tbpUnknownParam');
    expect(message).toContain('[');
  });

  it('does not throw once the unregistered route is gone', async () => {
    // Confirms the previous test's throw came from the probe and that the
    // real pages tree is fully covered by registered expanders.
    rmSync(probeDir, { recursive: true, force: true });
    vi.resetModules();
    const fresh = (await import('../src/lib/site-routes')) as unknown as Subject;
    expect(() => fresh.listSiteRoutes()).not.toThrow();
  });
});

describe('listSiteRoutes coverage vs the pages tree', () => {
  it('announces at least one path per route pattern, static or dynamic', () => {
    // The unit's reason to exist: no page in src/pages/ may be missing from
    // the discovery surface. The only sanctioned omission is the
    // /scorecards/draft/ alias, which is not its own file.
    const routes = listSiteRoutes();
    const uncovered = routePatterns.filter((pattern) => {
      const re = patternToRegExp(pattern);
      return !routes.some((route) => re.test(route));
    });
    expect(uncovered).toEqual([]);
  });

  it('announces more than the 95 paths the old hardcoded array did', () => {
    // Spec background: 95 of roughly 425 live pages were announced. A count
    // back near 95 means the derivation collapsed to a subset again.
    expect(listSiteRoutes().length).toBeGreaterThan(95);
  });
});
