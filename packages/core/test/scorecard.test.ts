import { describe, expect, it } from 'vitest';
import {
  LATEST_SCORECARD,
  SCORECARDS,
  getScorecard,
  listScorecards,
} from '../src/scorecard';
import { SCORECARD_0_2_0 } from '../src/scorecard/v0_2';

describe('scorecard registry', () => {
  it('exposes v0.2.0 as the latest scorecard', () => {
    expect(LATEST_SCORECARD).toBe('0.2.0');
    expect(SCORECARDS['0.2.0']).toBe(SCORECARD_0_2_0);
  });

  it('lists every shipped scorecard', () => {
    const versions = listScorecards().map((s) => s.version);
    expect(versions).toContain('0.2.0');
  });

  it('v0.2.0 manifest covers all 38 spec checks', () => {
    expect(Object.keys(SCORECARD_0_2_0.checks)).toHaveLength(38);
  });

  it('v0.2.0 pins every check to implementation 1.0.0', () => {
    for (const v of Object.values(SCORECARD_0_2_0.checks)) {
      expect(v).toBe('1.0.0');
    }
  });

  it('throws a clear error for unknown scorecard versions', () => {
    expect(() => getScorecard('9.9.9')).toThrow(/Unknown scorecard/);
  });

  it('resolves v0.2.0 to a runnable scorecard with 14 site + 24 page checks', () => {
    const resolved = getScorecard('0.2.0');
    expect(resolved.version).toBe('0.2.0');
    expect(resolved.siteChecks).toHaveLength(14);
    expect(resolved.pageChecks).toHaveLength(24);
    // Every resolved check carries its implementation version so reports
    // can show exactly which behavior was exercised.
    for (const c of [...resolved.siteChecks, ...resolved.pageChecks]) {
      expect(c.implementationVersion).toBe('1.0.0');
      expect(typeof c.run).toBe('function');
    }
  });
});
