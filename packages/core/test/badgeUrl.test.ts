import { describe, expect, it } from 'vitest';
import { buildBadgeUrl, parseBadgeParams, BADGE_BASE_URL } from '../src/report/badgeUrl';
import type { SiteRun } from '../src/runner/runSite';

const baseRun: SiteRun = {
  url: 'https://example.com',
  baseUrl: 'https://example.com/',
  mode: 'site',
  scorecardVersion: '0.2.0',
  scorecardReleasedAt: '2026-04-01T00:00:00.000Z',
  startedAt: '2026-04-30T12:00:00.000Z',
  finishedAt: '2026-04-30T12:01:00.000Z',
  siteChecks: [],
  pages: [],
  summary: {
    passed: 32,
    failed: 3,
    warned: 0,
    errored: 0,
    na: 3,
    total: 38,
    applicable: 35,
    score: 91,
  },
};

describe('buildBadgeUrl', () => {
  it('encodes every summary field, run mode, and audited url', () => {
    const url = new URL(buildBadgeUrl(baseRun));
    expect(url.origin + url.pathname).toBe(`${BADGE_BASE_URL}/badge/`);
    expect(url.searchParams.get('s')).toBe('91');
    expect(url.searchParams.get('v')).toBe('0.2.0');
    expect(url.searchParams.get('a')).toBe('35');
    expect(url.searchParams.get('t')).toBe('38');
    expect(url.searchParams.get('p')).toBe('32');
    expect(url.searchParams.get('f')).toBe('3');
    expect(url.searchParams.get('w')).toBe('0');
    expect(url.searchParams.get('e')).toBe('0');
    expect(url.searchParams.get('n')).toBe('3');
    expect(url.searchParams.get('d')).toBe('2026-04-30');
    expect(url.searchParams.get('m')).toBe('site');
    expect(url.searchParams.get('u')).toBe('https://example.com');
  });

  it('honors a custom base url (used by tests / dev)', () => {
    expect(buildBadgeUrl(baseRun, 'http://localhost:4321').startsWith(
      'http://localhost:4321/badge/?',
    )).toBe(true);
  });
});

describe('parseBadgeParams', () => {
  it('round-trips a built url', () => {
    const parsed = parseBadgeParams(new URL(buildBadgeUrl(baseRun)).search);
    expect(parsed).toEqual({
      score: 91,
      scorecardVersion: '0.2.0',
      applicable: 35,
      total: 38,
      passed: 32,
      failed: 3,
      warned: 0,
      errored: 0,
      na: 3,
      date: '2026-04-30',
      mode: 'site',
      url: 'https://example.com',
      theme: 'light',
    });
  });

  it('returns null when required fields (s/a/t) are missing or non-numeric', () => {
    expect(parseBadgeParams('?v=0.2.0')).toBeNull();
    expect(parseBadgeParams('?s=abc&a=10&t=20')).toBeNull();
  });

  it('clamps theme to light or dark; auto and unknown fall back to light', () => {
    const built = buildBadgeUrl(baseRun);
    expect(parseBadgeParams(new URL(built + '&theme=dark').search)?.theme).toBe('dark');
    expect(parseBadgeParams(new URL(built + '&theme=neon').search)?.theme).toBe('light');
    // Stale snippets generated before round-3 may carry theme=auto. Treat
    // them as light rather than throwing or rendering with a removed branch.
    expect(parseBadgeParams(new URL(built + '&theme=auto').search)?.theme).toBe('light');
  });

  it('drops mode when it is not page|site', () => {
    const built = buildBadgeUrl(baseRun).replace('m=site', 'm=other');
    expect(parseBadgeParams(new URL(built).search)?.mode).toBeUndefined();
  });
});
