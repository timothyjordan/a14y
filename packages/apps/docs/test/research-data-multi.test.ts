import { describe, expect, it } from 'vitest';
import {
  getPromotedScorecard,
  getResearchData,
  getResearchDataFor,
  listAvailableScorecards,
} from '../src/lib/research-data';
import {
  listVersionedRunScorecards,
  loadSiteRun,
  listSiteRunSlugs,
} from '../src/lib/site-run';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const LEADERBOARD_DIR = resolve(process.cwd(), 'src', 'data', 'leaderboard');
const HAS_MULTI = existsSync(LEADERBOARD_DIR);

// The /leaderboard/ page must work both before and after the TJ-583
// publish step has populated `src/data/leaderboard/`. The tests below
// assert the graceful-degrade contract when that directory is absent,
// and (when it IS present) assert the multi-scorecard contract.
describe('multi-scorecard loaders — graceful degrade', () => {
  it('listAvailableScorecards returns empty array when no leaderboard/ dir is published yet', () => {
    if (HAS_MULTI) return; // Skip when fixtures exist (multi-mode test below covers this case).
    expect(listAvailableScorecards()).toEqual([]);
  });

  it('getPromotedScorecard returns null when latest.json is absent', () => {
    if (HAS_MULTI) return;
    expect(getPromotedScorecard()).toBeNull();
  });

  it('getResearchDataFor throws a descriptive error for any version in single-scorecard mode', () => {
    if (HAS_MULTI) return;
    expect(() => getResearchDataFor('0.2.0')).toThrow(/No leaderboard data/i);
  });

  it('getResearchData still returns the legacy research.json shape unchanged', () => {
    const r = getResearchData();
    expect(typeof r.scorecardVersion).toBe('string');
    expect(Array.isArray(r.sites)).toBe(true);
  });

  it('listVersionedRunScorecards returns empty array in single-scorecard mode', () => {
    if (HAS_MULTI) return;
    expect(listVersionedRunScorecards()).toEqual([]);
  });

  it('loadSiteRun ignores the version arg when no per-version files exist and falls back to legacy runs/', async () => {
    // Same behavior as before — the version parameter is a hint, not a
    // requirement. A consumer passing a version while no per-version
    // data is on disk still gets the legacy run back rather than null.
    const [slug] = listSiteRunSlugs();
    if (!slug) return; // empty catalog (fresh checkout) — skip
    const run = await loadSiteRun(slug, '0.3.0-draft');
    expect(run).not.toBeNull();
    expect(typeof run!.summary.score).toBe('number');
  });
});

describe('multi-scorecard loaders — multi-mode (only runs when leaderboard/ is populated)', () => {
  it('listAvailableScorecards returns each published version in sorted order', () => {
    if (!HAS_MULTI) return;
    const versions = listAvailableScorecards();
    expect(versions.length).toBeGreaterThan(0);
    expect([...versions].sort()).toEqual(versions);
    for (const v of versions) {
      // Each listed version must round-trip through getResearchDataFor.
      const data = getResearchDataFor(v);
      expect(data.scorecardVersion).toBe(v);
    }
  });

  it('getPromotedScorecard resolves to one of the available versions', () => {
    if (!HAS_MULTI) return;
    const promoted = getPromotedScorecard();
    expect(promoted).not.toBeNull();
    expect(listAvailableScorecards()).toContain(promoted!);
  });

  it('getResearchDataFor throws on unknown version even when others are published', () => {
    if (!HAS_MULTI) return;
    expect(() => getResearchDataFor('99.9.9-nonexistent')).toThrow(/No leaderboard data/);
  });

  it('listVersionedRunScorecards returns the versions with a runs/ subtree on disk', () => {
    if (!HAS_MULTI) return;
    const runVersions = listVersionedRunScorecards();
    // Every version listed here must also be in listAvailableScorecards
    // (publish writes per-version runs/ for every version it emits a
    // leaderboard/<version>.json for).
    const available = new Set(listAvailableScorecards());
    for (const v of runVersions) expect(available.has(v)).toBe(true);
  });
});
