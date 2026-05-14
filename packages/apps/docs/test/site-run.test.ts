import { describe, expect, it } from 'vitest';
import { listSiteRunSlugs, loadSiteRun, scoreClass, siteRunUrl } from '../src/lib/site-run';
import { getLeaderboard } from '../src/lib/research-data';

describe('listSiteRunSlugs', () => {
  it('returns at least one published slug', () => {
    const slugs = listSiteRunSlugs();
    expect(slugs.length).toBeGreaterThan(0);
  });

  it('contains every slug present in the leaderboard (publish keeps them in lock-step)', () => {
    const slugs = new Set(listSiteRunSlugs());
    const missing = getLeaderboard()
      .filter((entry) => !slugs.has(entry.slug))
      .map((entry) => entry.slug);
    expect(missing).toEqual([]);
  });

  it('returns sorted, unique slugs', () => {
    const slugs = listSiteRunSlugs();
    const sorted = [...slugs].sort();
    expect(slugs).toEqual(sorted);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('loadSiteRun', () => {
  it('returns the SiteRun shape for a known leaderboard slug', () => {
    const slug = listSiteRunSlugs()[0];
    const run = loadSiteRun(slug);
    expect(run).not.toBeNull();
    expect(run!.url).toMatch(/^https?:\/\//);
    expect(typeof run!.summary.score).toBe('number');
    expect(Array.isArray(run!.pages)).toBe(true);
    expect(Array.isArray(run!.siteChecks)).toBe(true);
  });

  it('returns null for an unknown slug', () => {
    expect(loadSiteRun('definitely-not-a-real-site')).toBeNull();
  });

  it('contains no na checks (publish strips them)', () => {
    const slug = listSiteRunSlugs()[0];
    const run = loadSiteRun(slug)!;
    for (const c of run.siteChecks) expect(c.status).not.toBe('na');
    for (const page of run.pages) {
      for (const c of page.checks) expect(c.status).not.toBe('na');
    }
  });
});

describe('scoreClass', () => {
  it('classifies pass/warn/fail at the extension thresholds', () => {
    expect(scoreClass(100)).toBe('pass');
    expect(scoreClass(90)).toBe('pass');
    expect(scoreClass(89)).toBe('warn');
    expect(scoreClass(70)).toBe('warn');
    expect(scoreClass(69)).toBe('fail');
    expect(scoreClass(0)).toBe('fail');
  });
});

describe('siteRunUrl', () => {
  it('builds an internal route for a slug', () => {
    expect(siteRunUrl('react-dev')).toMatch(/\/research\/react-dev\/$/);
  });
});
