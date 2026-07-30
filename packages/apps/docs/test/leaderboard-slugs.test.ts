/**
 * Adversarial + property tests for `listLeaderboardSlugs`.
 *
 * Oracle source: `src/lib/site-routes.spec.md` (section "# listLeaderboardSlugs")
 * plus independent recomputation from the same data loaders the spec names
 * (`getLeaderboard`, `listSiteRunSlugs`) and the announced routes from
 * `listSiteRoutes`. The implementation body of `site-routes.ts` was never read
 * while writing these tests: every expectation is derived from the spec's
 * promises or recomputed independently, never from "what the code currently
 * does".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { listLeaderboardSlugs, listSiteRoutes } from '../src/lib/site-routes';
import { getLeaderboard } from '../src/lib/research-data';
import { listSiteRunSlugs } from '../src/lib/site-run';

/**
 * Independent recomputation of the expected slug set, straight from the spec:
 * "Include a slug for each leaderboard entry whose site run is published, and
 * no slug for a leaderboard entry without a published run." This mirrors the
 * filter the `/leaderboard/[slug]/` route's `getStaticPaths` applies, computed
 * here from the loaders rather than from the subject.
 */
const publishedRuns = new Set(listSiteRunSlugs());
const leaderboardEntries = getLeaderboard();
const knownSlugs = new Set(leaderboardEntries.map((e) => e.slug));
const expectedSlugs = leaderboardEntries
  .filter((e) => publishedRuns.has(e.slug))
  .map((e) => e.slug);

/** The `/leaderboard/<slug>/` paths `listSiteRoutes()` announces, slug-extracted. */
function announcedLeaderboardSlugs(): string[] {
  return listSiteRoutes()
    .filter((r) => r.startsWith('/leaderboard/') && r !== '/leaderboard/')
    .map((r) => r.slice('/leaderboard/'.length, -1));
}

describe('listLeaderboardSlugs shape', () => {
  it('returns a non-empty string[] (guards a vacuous test)', () => {
    const slugs = listLeaderboardSlugs();
    expect(Array.isArray(slugs)).toBe(true);
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) expect(typeof slug).toBe('string');
  });

  it('returns bare slugs: no slash, no /leaderboard/ prefix, no leading/trailing slash', () => {
    for (const slug of listLeaderboardSlugs()) {
      expect(slug).not.toContain('/');
      expect(slug.startsWith('/leaderboard/')).toBe(false);
      expect(slug.startsWith('/')).toBe(false);
      expect(slug.endsWith('/')).toBe(false);
      expect(slug.length).toBeGreaterThan(0);
    }
  });

  it('contains no duplicates', () => {
    const slugs = listLeaderboardSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('listLeaderboardSlugs published-run filter', () => {
  it('has published leaderboard runs to expect (guards a vacuous test)', () => {
    expect(expectedSlugs.length).toBeGreaterThan(0);
  });

  it('equals exactly the leaderboard entries whose site run is published (set-equality)', () => {
    // Recomputed independently from getLeaderboard() ∩ listSiteRunSlugs().
    // Anything extra advertises a URL that 404s; anything missing drops a live
    // per-site page.
    expect(new Set(listLeaderboardSlugs())).toEqual(new Set(expectedSlugs));
  });

  it('includes no slug for a leaderboard entry without a published run', () => {
    const unpublished = leaderboardEntries
      .filter((e) => !publishedRuns.has(e.slug))
      .map((e) => e.slug);
    const result = new Set(listLeaderboardSlugs());
    for (const slug of unpublished) {
      expect(result.has(slug)).toBe(false);
    }
  });

  it('every returned slug is a known leaderboard entry AND has a published run (reverse)', () => {
    // Reverse direction, so a slug source unrelated to getLeaderboard() (a raw
    // runs directory, a stale index) still has to satisfy both rules.
    for (const slug of listLeaderboardSlugs()) {
      expect(knownSlugs.has(slug), `${slug} is not a leaderboard entry`).toBe(true);
      expect(publishedRuns.has(slug), `${slug} has no published site run`).toBe(true);
    }
  });

  it('property: every element is bare, known, and published (exhaustive over the domain)', () => {
    // The returned slugs ARE the whole domain here, so an exhaustive check is
    // strictly stronger than random property sampling: the invariant must hold
    // for every element, with no counterexample.
    const invariant = (slug: string): boolean =>
      !slug.includes('/') &&
      !slug.startsWith('/') &&
      !slug.endsWith('/') &&
      knownSlugs.has(slug) &&
      publishedRuns.has(slug);
    const counterexamples = listLeaderboardSlugs().filter((slug) => !invariant(slug));
    expect(counterexamples).toEqual([]);
  });
});

describe('listLeaderboardSlugs one-to-one with announced leaderboard routes', () => {
  it('matches the /leaderboard/<slug>/ paths listSiteRoutes() emits, both directions', () => {
    const fromSlugs = new Set(
      listLeaderboardSlugs().map((slug) => `/leaderboard/${slug}/`),
    );
    const announced = new Set(
      listSiteRoutes().filter(
        (r) => r.startsWith('/leaderboard/') && r !== '/leaderboard/',
      ),
    );
    // Forward: every slug produces an announced route.
    expect(fromSlugs).toEqual(announced);
    // And the raw slug↔slug correspondence, symmetrically.
    expect(new Set(listLeaderboardSlugs())).toEqual(new Set(announcedLeaderboardSlugs()));
  });

  it('excludes the /leaderboard/ index (it is not a slug)', () => {
    const routes = listSiteRoutes();
    expect(routes).toContain('/leaderboard/');
    expect(listLeaderboardSlugs()).not.toContain('');
    expect(announcedLeaderboardSlugs()).not.toContain('');
  });
});

describe('listLeaderboardSlugs determinism', () => {
  it('returns a deeply-equal list on repeated calls', () => {
    expect(listLeaderboardSlugs()).toEqual(listLeaderboardSlugs());
  });

  it('is not corrupted by a caller mutating a previously returned array', () => {
    // If the result were a memoised, shared array, this mutation would leak
    // into the next caller.
    const before = [...listLeaderboardSlugs()];
    const handed = listLeaderboardSlugs();
    handed.push('tbp-mutation-sentinel');
    (handed as string[]).length = 0; // also try clearing it entirely
    const after = listLeaderboardSlugs();
    expect(after).not.toContain('tbp-mutation-sentinel');
    expect(after).toEqual(before);
  });
});

describe('listLeaderboardSlugs throws when no run resolves as published', () => {
  afterEach(() => {
    vi.doUnmock('../src/lib/site-run');
    vi.resetModules();
  });

  it('throws when the leaderboard has entries but no site run is published', async () => {
    // Spec: "Throw when the leaderboard has entries but no site run resolves as
    // published ... Returning an empty list would silently drop every per-site
    // page." Simulated by mocking the runs loader to report nothing published
    // while getLeaderboard() (real, non-empty) still has entries. No
    // implementation source was read to construct this; the mock targets the
    // public loader the spec references.
    expect(leaderboardEntries.length).toBeGreaterThan(0); // precondition for the throw
    vi.resetModules();
    vi.doMock('../src/lib/site-run', () => ({ listSiteRunSlugs: () => [] }));
    const fresh = await import('../src/lib/site-routes');
    expect(() => fresh.listLeaderboardSlugs()).toThrow();
  });
});
