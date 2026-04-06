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

  it('throws when a manifest references a check not in the registry', () => {
    // None of the v0.2.0 checks are registered yet (TJ-96 / TJ-97 will add
    // them). The resolver MUST surface a loud error rather than silently
    // dropping the missing check, otherwise frozen scorecards could drift.
    expect(() => getScorecard('0.2.0')).toThrow(/unknown check id/);
  });
});
