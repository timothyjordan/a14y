import { describe, expect, it } from 'vitest';
import type { SiteRun } from '@a14y/core';
import { decideView } from '../src/lib/results-view';
import { STALE_PROGRESS_MS, type CurrentRunState } from '../src/bridge';

const NOW = Date.parse('2026-04-25T10:00:00.000Z');
const FRESH_AT = '2026-04-25T09:59:55.000Z'; // 5s before NOW
const STALE_AT = '2026-04-25T09:58:00.000Z'; // 2 min before NOW

function makeState(overrides: Partial<CurrentRunState>): CurrentRunState {
  return {
    status: 'running',
    url: 'https://example.com/',
    mode: 'page',
    scorecardVersion: '0.2.0',
    startedAt: '2026-04-25T09:59:00.000Z',
    lastProgressAt: FRESH_AT,
    progress: { phase: 'Visiting…', visited: 1, pct: 25 },
    ...overrides,
  };
}

function makeRun(overrides: Partial<SiteRun> = {}): SiteRun {
  return {
    url: 'https://example.com/',
    baseUrl: 'https://example.com/',
    mode: 'page',
    scorecardVersion: '0.2.0',
    scorecardReleasedAt: '2026-04-06',
    startedAt: '2026-04-25T09:00:00.000Z',
    finishedAt: '2026-04-25T09:00:15.000Z',
    siteChecks: [],
    pages: [],
    summary: { score: 88, total: 0, passed: 0, failed: 0, warned: 0, errored: 0, na: 0, applicable: 0 },
    ...overrides,
  };
}

describe('decideView (TJ-210)', () => {
  it('returns empty when nothing has ever happened', () => {
    expect(decideView(null, [], NOW)).toBe('empty');
  });

  it('returns report-historical when only past runs exist', () => {
    expect(decideView(null, [makeRun()], NOW)).toBe('report-historical');
  });

  it('returns progress for a fresh running state, even if history exists', () => {
    expect(decideView(makeState({ status: 'running' }), [makeRun()], NOW)).toBe('progress');
  });

  it('returns stalled when a running state has no progress for STALE_PROGRESS_MS', () => {
    expect(
      decideView(makeState({ status: 'running', lastProgressAt: STALE_AT }), [], NOW),
    ).toBe('stalled');
  });

  it('treats just-over the stale threshold as stalled', () => {
    const stale = new Date(NOW - STALE_PROGRESS_MS - 1).toISOString();
    expect(
      decideView(makeState({ status: 'running', lastProgressAt: stale }), [], NOW),
    ).toBe('stalled');
  });

  it('returns report-current for a done state with a result', () => {
    const result = makeRun({ summary: { ...makeRun().summary, score: 95 } });
    expect(
      decideView(makeState({ status: 'done', result }), [makeRun()], NOW),
    ).toBe('report-current');
  });

  it('returns report-historical when a done state has no result attached', () => {
    // Defensive: the storage entry could theoretically be missing the
    // result object. Fall through to history.
    expect(
      decideView(makeState({ status: 'done', result: undefined }), [makeRun()], NOW),
    ).toBe('report-historical');
  });

  it('returns error for an errored state', () => {
    expect(
      decideView(makeState({ status: 'error', error: 'boom' }), [makeRun()], NOW),
    ).toBe('error');
  });

  it('treats idle status as if no current run', () => {
    expect(decideView(makeState({ status: 'idle' }), [makeRun()], NOW)).toBe(
      'report-historical',
    );
    expect(decideView(makeState({ status: 'idle' }), [], NOW)).toBe('empty');
  });
});
