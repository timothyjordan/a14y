import { describe, expect, it } from 'vitest';
import {
  DRAFT_SCORECARD_VERSION,
  LATEST_SCORECARD,
  SCORECARDS,
  getScorecard,
  isDraftScorecardVersion,
  listScorecards,
  resolveScorecardSelector,
} from '../src/scorecard';
import { SCORECARD_DRAFT } from '../src/scorecard/draft';

/**
 * Permissive tests for the draft scorecard. The draft's contents change as
 * contributions land, so these assertions verify SHAPE (resolves cleanly,
 * has at least one check of each scope, is properly tagged as a pre-release)
 * without pinning specific counts. Strict invariants live in scorecard.test.ts
 * and are anchored to the frozen v0.2.0 manifest.
 */
describe('draft scorecard', () => {
  it('exposes a -draft version distinct from LATEST_SCORECARD', () => {
    expect(DRAFT_SCORECARD_VERSION).toBe(SCORECARD_DRAFT.version);
    expect(DRAFT_SCORECARD_VERSION).toMatch(/-draft$/);
    expect(DRAFT_SCORECARD_VERSION).not.toBe(LATEST_SCORECARD);
    expect(isDraftScorecardVersion(DRAFT_SCORECARD_VERSION)).toBe(true);
    expect(isDraftScorecardVersion(LATEST_SCORECARD)).toBe(false);
  });

  it('is registered in SCORECARDS under its version key', () => {
    expect(SCORECARDS[DRAFT_SCORECARD_VERSION]).toBe(SCORECARD_DRAFT);
  });

  it('resolves via the literal "draft" alias and the explicit version', () => {
    const a = getScorecard('draft');
    const b = getScorecard(DRAFT_SCORECARD_VERSION);
    expect(a.version).toBe(DRAFT_SCORECARD_VERSION);
    expect(b.version).toBe(DRAFT_SCORECARD_VERSION);
    expect(a.siteChecks.length).toBe(b.siteChecks.length);
    expect(a.pageChecks.length).toBe(b.pageChecks.length);
  });

  it('resolveScorecardSelector translates aliases', () => {
    expect(resolveScorecardSelector('draft')).toBe(DRAFT_SCORECARD_VERSION);
    expect(resolveScorecardSelector('latest')).toBe(LATEST_SCORECARD);
    expect(resolveScorecardSelector('0.2.0')).toBe('0.2.0');
  });

  it('every check in the draft resolves to a runnable implementation', () => {
    const resolved = getScorecard('draft');
    expect(resolved.siteChecks.length + resolved.pageChecks.length).toBeGreaterThan(0);
    expect(resolved.siteChecks.length).toBeGreaterThan(0);
    expect(resolved.pageChecks.length).toBeGreaterThan(0);
    for (const c of [...resolved.siteChecks, ...resolved.pageChecks]) {
      expect(typeof c.run).toBe('function');
      expect(c.implementationVersion).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it('listScorecards sorts published entries before drafts', () => {
    const versions = listScorecards().map((s) => s.version);
    const lastPublishedIdx = versions
      .map((v, i) => (isDraftScorecardVersion(v) ? -1 : i))
      .reduce((a, b) => Math.max(a, b), -1);
    const firstDraftIdx = versions.findIndex(isDraftScorecardVersion);
    expect(firstDraftIdx).toBeGreaterThan(-1);
    expect(firstDraftIdx).toBeGreaterThan(lastPublishedIdx);
  });
});
