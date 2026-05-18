import { describe, expect, it } from 'vitest';
import {
  LATEST_SCORECARD,
  SCORECARDS,
  getScorecard,
  listScorecards,
} from '../src/scorecard';
import { SCORECARD_0_2_0 } from '../src/scorecard/v0_2';
import { SCORECARD_DRAFT } from '../src/scorecard/draft';
import type { ScorecardManifest } from '../src/scorecard/types';

describe('scorecard registry', () => {
  it('exposes v0.2.0 as the latest scorecard', () => {
    expect(LATEST_SCORECARD).toBe('0.2.0');
    expect(SCORECARDS['0.2.0']).toBe(SCORECARD_0_2_0);
  });

  it('lists every shipped scorecard, including the draft', () => {
    const versions = listScorecards().map((s) => s.version);
    expect(versions).toContain('0.2.0');
    // The draft is also included; covered in detail by scorecard.draft.test.ts.
    expect(versions.some((v) => v.endsWith('-draft'))).toBe(true);
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

describe('scoringMethodology', () => {
  it('v0.2.0 pins flat-pool-v1', () => {
    expect(SCORECARD_0_2_0.scoringMethodology).toBe('flat-pool-v1');
    expect(getScorecard('0.2.0').scoringMethodology).toBe('flat-pool-v1');
  });

  it('the draft pins flat-pool-v1 (current state; later scorecards may diverge)', () => {
    expect(SCORECARD_DRAFT.scoringMethodology).toBe('flat-pool-v1');
    expect(getScorecard('draft').scoringMethodology).toBe('flat-pool-v1');
  });

  it('defaults to flat-pool-v1 when a manifest omits the field', () => {
    // Backwards-compat: third-party manifests authored before this field
    // existed must still resolve. The default must be flat-pool-v1 because
    // that's the algorithm every existing consumer was using before the
    // field landed.
    const legacy: ScorecardManifest = {
      version: '9.9.9-legacy-test',
      releasedAt: 'never',
      description: 'legacy manifest without scoringMethodology',
      checks: { ...SCORECARD_0_2_0.checks },
    };
    SCORECARDS[legacy.version] = legacy;
    try {
      expect(getScorecard(legacy.version).scoringMethodology).toBe('flat-pool-v1');
    } finally {
      delete SCORECARDS[legacy.version];
    }
  });

  it('throws when a manifest pins an unknown scoringMethodology', () => {
    const bad: ScorecardManifest = {
      version: '9.9.9-bad-methodology-test',
      releasedAt: 'never',
      description: 'manifest with unknown scoringMethodology',
      checks: { ...SCORECARD_0_2_0.checks },
      // Intentionally widened: simulate a future variant landing in the type
      // without a matching dispatch branch.
      scoringMethodology: 'imaginary-v9' as unknown as 'flat-pool-v1',
    };
    SCORECARDS[bad.version] = bad;
    try {
      expect(() => getScorecard(bad.version)).toThrow(
        /unknown scoringMethodology "imaginary-v9"/i,
      );
    } finally {
      delete SCORECARDS[bad.version];
    }
  });
});
