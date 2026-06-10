import { describe, expect, it } from 'vitest';
import { buildBadgeUrl, type SiteRun } from '@a14y/core';
import {
  leaderboardEntryBadgeUrl,
  type LeaderboardEntry,
} from '../src/lib/research-data';

// LeaderboardEntry flattens `score` to the top level (the leaderboard
// data shape predates SiteRun-based badge wiring). The adapter helper
// in research-data.ts must produce the same URL `buildBadgeUrl(run)`
// would for an equivalent SiteRun, or the per-row "embed" link on the
// leaderboard will silently disagree with the per-site report page's
// "Embed your badge" button. This sync test pins the contract.

const entry: LeaderboardEntry = {
  slug: 'example',
  name: 'Example',
  url: 'https://example.com',
  category: 'docs-platform',
  mode: 'site',
  score: 91,
  summary: {
    passed: 32,
    failed: 3,
    warned: 0,
    errored: 0,
    na: 3,
    total: 38,
    applicable: 35,
  },
  topFailures: [],
  scannedAt: '2026-04-30T12:01:00.000Z',
};

const equivalentRun: SiteRun = {
  url: entry.url,
  baseUrl: `${entry.url}/`,
  mode: entry.mode,
  scorecardVersion: '0.2.0',
  scorecardReleasedAt: '2026-04-01T00:00:00.000Z',
  startedAt: '2026-04-30T12:00:00.000Z',
  finishedAt: entry.scannedAt,
  siteChecks: [],
  pages: [],
  summary: {
    ...entry.summary,
    score: entry.score,
  },
};

describe('leaderboardEntryBadgeUrl (adapter sync vs @a14y/core buildBadgeUrl)', () => {
  it('produces the same URL as buildBadgeUrl(run) for an equivalent SiteRun', () => {
    expect(leaderboardEntryBadgeUrl(entry, '0.2.0')).toBe(buildBadgeUrl(equivalentRun));
  });

  it('encodes every short-key query param the badge page expects', () => {
    const url = new URL(leaderboardEntryBadgeUrl(entry, '0.2.0'));
    expect(url.pathname).toBe('/badge/');
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
});
