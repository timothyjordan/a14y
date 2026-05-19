import { describe, expect, it } from 'vitest';
import { loadDraftChanges, type DraftChange } from '../src/scorecard';

describe('loadDraftChanges', () => {
  it('returns the methodology-bumped entry seeded for v0.2.0 → v0.3.0-draft', () => {
    const { changes } = loadDraftChanges();
    const methodology = changes.filter(
      (c): c is Extract<DraftChange, { kind: 'methodology-bumped' }> =>
        c.kind === 'methodology-bumped',
    );
    expect(methodology).toHaveLength(1);
    expect(methodology[0].fromMethodology).toBe('flat-pool-v1');
    expect(methodology[0].toMethodology).toBe('per-check-mean-v1');
    expect(methodology[0].pr).toBe(53);
  });

  it('still surfaces the three check-level entries from PR #34', () => {
    const { changes } = loadDraftChanges();
    const checkIds = changes
      .filter((c): c is Extract<DraftChange, { kind: 'added' }> => c.kind === 'added')
      .map((c) => c.checkId)
      .sort();
    expect(checkIds).toEqual([
      'markdown.navigation-stripped',
      'markdown.size-reduction',
      'markdown.valid-markdown',
    ]);
  });

  it('contains no duplicate methodology entries', () => {
    // Methodology bumps are scorecard-wide (singleton). If the schema ever
    // permits multiple, the refresh script + UI need rework — guard that here.
    const { changes } = loadDraftChanges();
    const count = changes.filter((c) => c.kind === 'methodology-bumped').length;
    expect(count).toBeLessThanOrEqual(1);
  });

  it('narrows correctly on kind (TypeScript discriminated-union sanity check)', () => {
    // Compile-time guarantee surfaced at runtime: a methodology-bumped entry
    // does NOT carry checkId; check-level entries do. If either invariant
    // breaks at the type level, this test fails to compile.
    const { changes } = loadDraftChanges();
    for (const change of changes) {
      if (change.kind === 'methodology-bumped') {
        expect(typeof change.fromMethodology).toBe('string');
        expect(typeof change.toMethodology).toBe('string');
      } else {
        expect(typeof change.checkId).toBe('string');
      }
    }
  });
});
