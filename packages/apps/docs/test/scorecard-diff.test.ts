import { describe, expect, it } from 'vitest';
import {
  diffCheckMaps,
  diffScorecards,
  getDraftDiff,
  getDraftDiffEntries,
  getDraftMethodologyDiff,
  getLatestScorecardVersion,
  getDraftScorecardVersion,
  getMethodologyHref,
} from '../src/lib/scorecard-data';

describe('diffCheckMaps', () => {
  it('returns empty buckets for identical maps', () => {
    const map = { 'a.one': '1.0.0', 'b.two': '1.0.0' };
    expect(diffCheckMaps(map, map)).toEqual({ added: [], removed: [], bumped: [] });
  });

  it('detects added ids', () => {
    const from = { 'a.one': '1.0.0' };
    const to = { 'a.one': '1.0.0', 'b.two': '1.0.0' };
    expect(diffCheckMaps(from, to)).toEqual({
      added: [{ id: 'b.two', toImpl: '1.0.0' }],
      removed: [],
      bumped: [],
    });
  });

  it('detects removed ids', () => {
    const from = { 'a.one': '1.0.0', 'b.two': '1.0.0' };
    const to = { 'a.one': '1.0.0' };
    expect(diffCheckMaps(from, to)).toEqual({
      added: [],
      removed: [{ id: 'b.two', fromImpl: '1.0.0' }],
      bumped: [],
    });
  });

  it('detects bumped implementation versions', () => {
    const from = { 'a.one': '1.0.0' };
    const to = { 'a.one': '1.1.0' };
    expect(diffCheckMaps(from, to)).toEqual({
      added: [],
      removed: [],
      bumped: [{ id: 'a.one', fromImpl: '1.0.0', toImpl: '1.1.0' }],
    });
  });

  it('categorises a combined diff correctly and sorts ids alphabetically', () => {
    const from = {
      'z.removed': '1.0.0',
      'b.bumped': '1.0.0',
      'k.stable': '1.0.0',
    };
    const to = {
      'm.added': '1.0.0',
      'a.added': '1.0.0',
      'b.bumped': '1.1.0',
      'k.stable': '1.0.0',
    };
    expect(diffCheckMaps(from, to)).toEqual({
      added: [
        { id: 'a.added', toImpl: '1.0.0' },
        { id: 'm.added', toImpl: '1.0.0' },
      ],
      removed: [{ id: 'z.removed', fromImpl: '1.0.0' }],
      bumped: [{ id: 'b.bumped', fromImpl: '1.0.0', toImpl: '1.1.0' }],
    });
  });
});

describe('diffScorecards', () => {
  it('returns an empty diff when comparing the latest published to itself', () => {
    const latest = getLatestScorecardVersion();
    const diff = diffScorecards(latest, latest);
    expect(diff.fromVersion).toBe(latest);
    expect(diff.toVersion).toBe(latest);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.bumped).toEqual([]);
  });

  it('resolves the `draft` and `latest` aliases to concrete versions', () => {
    const diff = diffScorecards('latest', 'draft');
    expect(diff.fromVersion).toBe(getLatestScorecardVersion());
    expect(diff.toVersion).toBe(getDraftScorecardVersion());
  });

  it('throws a descriptive error for unknown versions', () => {
    expect(() => diffScorecards('0.0.0-nope', getLatestScorecardVersion())).toThrow(
      /Unknown scorecard version "0\.0\.0-nope"/,
    );
  });

  it('reports today\'s draft-vs-latest with the new checks added and the modified-date checks bumped', () => {
    // The draft has diverged from the latest published scorecard:
    //   - TJ-456 landed three new markdown.* checks (additions).
    //   - A14Y-101 landed three agent-specific checks from Google's AI
    //     optimization guide (html.ssr-content, discovery.no-duplicate-content,
    //     http.no-interstitial) as additions.
    //   - TJ-676 landed discovery.in-page-link (agent files linked in-page)
    //     as a spec-PR addition.
    //   - The modified-date pair was bumped 1.0.0 → 1.1.0 to require
    //     the value to parse as the spec-defined date format.
    //   - The discovery-file existence trio (agents-md / llms-txt /
    //     sitemap-md .exists) was bumped 1.0.0 → 1.1.0 to reject soft-200
    //     responses, after the 50k bulk survey exposed 1.0.0 false positives.
    // If a future PR removes / further bumps these, update this assertion.
    const diff = getDraftDiff();
    expect(diff.added.map((a) => a.id).sort()).toEqual([
      'discovery.in-page-link',
      'discovery.no-duplicate-content',
      'html.ssr-content',
      'http.no-interstitial',
      'markdown.navigation-stripped',
      'markdown.size-reduction',
      'markdown.valid-markdown',
    ]);
    expect(diff.removed).toEqual([]);
    expect(
      diff.bumped
        .map((b) => ({ id: b.id, fromImpl: b.fromImpl, toImpl: b.toImpl }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([
      { id: 'agents-md.exists', fromImpl: '1.0.0', toImpl: '1.1.0' },
      { id: 'html.json-ld.date-modified', fromImpl: '1.0.0', toImpl: '1.1.0' },
      { id: 'llms-txt.exists', fromImpl: '1.0.0', toImpl: '1.1.0' },
      { id: 'sitemap-md.exists', fromImpl: '1.0.0', toImpl: '1.1.0' },
      { id: 'sitemap-xml.has-lastmod', fromImpl: '1.0.0', toImpl: '1.1.0' },
    ]);
  });
});

describe('getDraftDiffEntries', () => {
  it('returns one entry per check that has diverged from the latest published', () => {
    const checkIds = getDraftDiffEntries()
      .filter((e) => e.kind !== 'methodology-bumped')
      .map((e) => (e.kind === 'methodology-bumped' ? '' : e.id))
      .sort();
    expect(checkIds).toEqual([
      'agents-md.exists',
      'discovery.in-page-link',
      'discovery.no-duplicate-content',
      'html.json-ld.date-modified',
      'html.ssr-content',
      'http.no-interstitial',
      'llms-txt.exists',
      'markdown.navigation-stripped',
      'markdown.size-reduction',
      'markdown.valid-markdown',
      'sitemap-md.exists',
      'sitemap-xml.has-lastmod',
    ]);
  });

  it('includes a methodology-bumped entry for the v0.2.0 → v0.3.0-draft change', () => {
    const entries = getDraftDiffEntries();
    const methodology = entries.find((e) => e.kind === 'methodology-bumped');
    expect(methodology, 'expected a methodology-bumped entry').toBeDefined();
    if (methodology?.kind !== 'methodology-bumped') return; // narrows for TS
    expect(methodology.fromMethodology).toBe('flat-pool-v1');
    expect(methodology.toMethodology).toBe('per-check-mean-v1');
    // PR #53 is the seed; if a later PR changes the methodology again, this
    // attribution will move to that PR — update the assertion at that point.
    expect(methodology.attribution).not.toBeNull();
    expect(methodology.attribution?.pr).toBe(53);
  });

  it('places the methodology entry first when it exists', () => {
    // Methodology bumps are scorecard-wide and should read above the per-check
    // changes in every consumer that doesn't re-sort.
    const entries = getDraftDiffEntries();
    expect(entries[0]?.kind).toBe('methodology-bumped');
  });
});

describe('getDraftMethodologyDiff', () => {
  it('returns the current v0.2.0 → v0.3.0-draft methodology bump', () => {
    const diff = getDraftMethodologyDiff();
    expect(diff).not.toBeNull();
    expect(diff?.fromMethodology).toBe('flat-pool-v1');
    expect(diff?.toMethodology).toBe('per-check-mean-v1');
  });
});

describe('getMethodologyHref', () => {
  it('builds the canonical /scorecards/scoring/<id>/ URL', () => {
    expect(getMethodologyHref('flat-pool-v1')).toMatch(
      /\/scorecards\/scoring\/flat-pool-v1\/$/,
    );
    expect(getMethodologyHref('per-check-mean-v1')).toMatch(
      /\/scorecards\/scoring\/per-check-mean-v1\/$/,
    );
  });
});
