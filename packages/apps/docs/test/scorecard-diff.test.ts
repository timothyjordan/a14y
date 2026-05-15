import { describe, expect, it } from 'vitest';
import {
  diffCheckMaps,
  diffScorecards,
  getDraftDiff,
  getDraftDiffEntries,
  getLatestScorecardVersion,
  getDraftScorecardVersion,
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

  it('reports today\'s draft-vs-latest with the new markdown.* checks added', () => {
    // The draft has diverged from the latest published scorecard: TJ-456
    // landed three new markdown.* checks (spec PR). If a future PR removes
    // or bumps them, update this assertion to match.
    const diff = getDraftDiff();
    expect(diff.added.map((a) => a.id).sort()).toEqual([
      'markdown.navigation-stripped',
      'markdown.size-reduction',
      'markdown.valid-markdown',
    ]);
    expect(diff.removed).toEqual([]);
    expect(diff.bumped).toEqual([]);
  });
});

describe('getDraftDiffEntries', () => {
  it('returns one entry per check that has diverged from the latest published', () => {
    const ids = getDraftDiffEntries().map((e) => e.id).sort();
    expect(ids).toEqual([
      'markdown.navigation-stripped',
      'markdown.size-reduction',
      'markdown.valid-markdown',
    ]);
  });
});
