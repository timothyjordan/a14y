import { describe, expect, it } from 'vitest';
import {
  compareScorecardVersions,
  getLatestAvailableScorecard,
  getPromotedScorecard,
  getResearchData,
  getResearchDataFor,
  listAvailableScorecards,
} from '../src/lib/research-data';
import {
  listVersionedRunScorecards,
  loadSiteRun,
  listSiteRunSlugs,
  siteRunUrl,
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

  it('getLatestAvailableScorecard returns null when no per-version data is on disk', () => {
    if (HAS_MULTI) return;
    expect(getLatestAvailableScorecard()).toBeNull();
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

  it('siteRunUrl(slug) returns the bare per-site path in any mode', () => {
    expect(siteRunUrl('posthog')).toMatch(/\/leaderboard\/posthog\/$/);
  });

  it('siteRunUrl(slug, version) appends ?scorecard= in single-scorecard mode (no latest known)', () => {
    if (HAS_MULTI) return;
    // With no per-version data on disk, `latest` is null and every
    // explicit version arg is treated as non-latest, producing a query.
    expect(siteRunUrl('posthog', '0.2.0')).toMatch(/\?scorecard=0\.2\.0$/);
  });
});

describe('compareScorecardVersions', () => {
  it('orders major.minor.patch numerically (not lexicographically)', () => {
    expect(compareScorecardVersions('0.2.0', '0.10.0')).toBeLessThan(0);
    expect(compareScorecardVersions('9.0.0', '10.0.0')).toBeLessThan(0);
    expect(compareScorecardVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('treats pre-release as LOWER than the corresponding release at the same base', () => {
    // Semver convention: `0.3.0-draft` is older than `0.3.0`.
    expect(compareScorecardVersions('0.3.0-draft', '0.3.0')).toBeLessThan(0);
    expect(compareScorecardVersions('0.3.0', '0.3.0-draft')).toBeGreaterThan(0);
  });

  it('orders different bases by base, ignoring whether either has a pre-release', () => {
    // `0.3.0-draft` is newer than `0.2.0` even though one is pre-release —
    // the base 0.3.0 > 0.2.0 wins.
    expect(compareScorecardVersions('0.2.0', '0.3.0-draft')).toBeLessThan(0);
    expect(compareScorecardVersions('0.3.0-draft', '0.2.0')).toBeGreaterThan(0);
  });

  it('sorting a list descending yields newest → oldest', () => {
    const versions = ['0.3.0-draft', '0.2.0', '0.3.0', '0.10.0-draft'];
    const sorted = [...versions].sort((a, b) => compareScorecardVersions(b, a));
    expect(sorted).toEqual(['0.10.0-draft', '0.3.0', '0.3.0-draft', '0.2.0']);
  });
});

describe('multi-scorecard loaders — multi-mode (only runs when leaderboard/ is populated)', () => {
  it('listAvailableScorecards returns each published version newest → oldest', () => {
    if (!HAS_MULTI) return;
    const versions = listAvailableScorecards();
    expect(versions.length).toBeGreaterThan(0);
    // Confirm the order matches a semver descending sort.
    const expected = [...versions].sort((a, b) => compareScorecardVersions(b, a));
    expect(versions).toEqual(expected);
    for (const v of versions) {
      const data = getResearchDataFor(v);
      expect(data.scorecardVersion).toBe(v);
    }
  });

  it('getLatestAvailableScorecard returns the newest version in the available list', () => {
    if (!HAS_MULTI) return;
    const versions = listAvailableScorecards();
    expect(getLatestAvailableScorecard()).toBe(versions[0]);
  });

  it('getPromotedScorecard resolves to one of the available versions (or null when latest.json absent)', () => {
    if (!HAS_MULTI) return;
    // Promoted is set by the publish step's --promote flag and lives
    // in latest.json. It MAY differ from getLatestAvailableScorecard
    // (operator could deliberately point the legacy alias at an
    // older version during a rollout). The contract here is only
    // that when set, it must be one of the available versions.
    const promoted = getPromotedScorecard();
    if (promoted) {
      expect(listAvailableScorecards()).toContain(promoted);
    }
  });

  it('getResearchDataFor throws on unknown version even when others are published', () => {
    if (!HAS_MULTI) return;
    expect(() => getResearchDataFor('99.9.9-nonexistent')).toThrow(/No leaderboard data/);
  });

  it('listVersionedRunScorecards returns the versions with a runs/ subtree on disk, newest first', () => {
    if (!HAS_MULTI) return;
    const runVersions = listVersionedRunScorecards();
    // Order: matches the semver-descending sort.
    const expected = [...runVersions].sort((a, b) => compareScorecardVersions(b, a));
    expect(runVersions).toEqual(expected);
    // Every version listed here must also be in listAvailableScorecards
    // (publish writes per-version runs/ for every version it emits a
    // leaderboard/<version>.json for).
    const available = new Set(listAvailableScorecards());
    for (const v of runVersions) expect(available.has(v)).toBe(true);
  });

  it('siteRunUrl omits ?scorecard= only for the latest version', () => {
    if (!HAS_MULTI) return;
    const latest = getLatestAvailableScorecard();
    if (!latest) return;
    expect(siteRunUrl('posthog', latest)).toMatch(/\/leaderboard\/posthog\/$/);
    const others = listAvailableScorecards().filter((v) => v !== latest);
    if (others.length > 0) {
      const other = others[0];
      expect(siteRunUrl('posthog', other)).toContain(`?scorecard=${other}`);
    }
  });

  it('loadSiteRun ignores the version arg when no per-version files exist and falls back to legacy runs/', async () => {
    const [slug] = listSiteRunSlugs();
    if (!slug) return;
    const run = await loadSiteRun(slug, '0.3.0-draft');
    expect(run).not.toBeNull();
    expect(typeof run!.summary.score).toBe('number');
  });
});
