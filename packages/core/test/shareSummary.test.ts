import { describe, expect, it } from 'vitest';
import { formatShareSummary } from '../src/report/shareSummary';
import type { SiteRun } from '../src/runner/runSite';

function run(overrides: Partial<SiteRun> = {}): SiteRun {
  return {
    url: 'https://example.com/',
    baseUrl: 'https://example.com/',
    mode: 'site',
    scorecardVersion: '0.2.0',
    scorecardReleasedAt: '2026-04-06',
    startedAt: '2026-04-07T10:00:00.000Z',
    finishedAt: '2026-04-07T10:00:15.000Z',
    siteChecks: [],
    pages: [],
    summary: {
      passed: 42,
      failed: 6,
      warned: 0,
      errored: 0,
      na: 0,
      total: 48,
      applicable: 48,
      score: 87,
    },
    ...overrides,
  };
}

describe('formatShareSummary', () => {
  it('renders the canonical lead with hostname, score, scorecard, and CTA', () => {
    const text = formatShareSummary(run(), { surface: 'cli' });
    expect(text).toContain('My site, example.com, scored 87/100 for Agent Readability.');
    expect(text).toContain('Scorecard v0.2.0 · 42/48 checks passed');
    expect(text).toContain(
      'Audit your own site at https://a14y.dev?utm_source=cli&utm_medium=share',
    );
  });

  it('strips protocol and path so only the hostname appears in the lead', () => {
    const text = formatShareSummary(
      run({ url: 'https://docs.example.co.uk/some/deep/path?x=1' }),
      { surface: 'cli' },
    );
    expect(text).toContain('My site, docs.example.co.uk,');
    expect(text).not.toContain('https://docs.example.co.uk');
    expect(text).not.toContain('/some/deep/path');
  });

  it('varies utm_source by surface', () => {
    expect(formatShareSummary(run(), { surface: 'cli' })).toContain('utm_source=cli');
    expect(formatShareSummary(run(), { surface: 'extension' })).toContain(
      'utm_source=extension',
    );
    expect(formatShareSummary(run(), { surface: 'skill' })).toContain('utm_source=skill');
  });

  it('appends the celebratory lift when priorScore is lower than the new score', () => {
    const text = formatShareSummary(run({ summary: { ...run().summary, score: 92 } }), {
      surface: 'skill',
      priorScore: 80,
    });
    expect(text).toContain(
      "My site, example.com, scored 92/100 for Agent Readability — up from 80 after today's fixes.",
    );
  });

  it('omits the lift when priorScore is equal to or higher than the new score', () => {
    const same = formatShareSummary(run(), { surface: 'skill', priorScore: 87 });
    const lower = formatShareSummary(run(), { surface: 'skill', priorScore: 90 });
    expect(same).not.toContain('up from');
    expect(same).toContain('My site, example.com, scored 87/100 for Agent Readability.');
    expect(lower).not.toContain('up from');
  });

  it('respects an explicit ctaUrl override', () => {
    const text = formatShareSummary(run(), {
      surface: 'cli',
      ctaUrl: 'https://example.test/share',
    });
    expect(text).toContain('Audit your own site at https://example.test/share');
    expect(text).not.toContain('a14y.dev');
  });

  it('stays under the 280-char tweet ceiling for typical inputs', () => {
    const typical = formatShareSummary(run(), { surface: 'cli' });
    const withLift = formatShareSummary(
      run({
        url: 'https://verylongbutreasonable.example.com/',
        summary: { ...run().summary, score: 99, passed: 999, applicable: 1000 },
      }),
      { surface: 'extension', priorScore: 12 },
    );
    expect(typical.length).toBeLessThanOrEqual(280);
    expect(withLift.length).toBeLessThanOrEqual(280);
  });

  it('falls back to the raw url string when URL parsing fails', () => {
    const text = formatShareSummary(run({ url: 'not a url' }), { surface: 'cli' });
    expect(text).toContain('My site, not a url, scored 87/100 for Agent Readability.');
  });
});
