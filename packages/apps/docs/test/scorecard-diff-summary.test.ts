import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const COMPONENT_PATH = fileURLToPath(
  new URL('../src/components/ScorecardDiffSummary.astro', import.meta.url),
);

describe('ScorecardDiffSummary stylesheet', () => {
  // Regression guard for TJ-493: the chip used to render as
  // `+N new·M bumped ·−K removedvs vX.Y.Z` because `display: inline-flex`
  // dropped leading/trailing whitespace on the literal text-node separators
  // (`{' · '}`, `{' '}`). The visible bug only surfaces in a real browser's
  // flex layout — vitest can't see it — so we assert the source rule instead.
  const source = fs.readFileSync(COMPONENT_PATH, 'utf-8');
  const ruleMatch = source.match(/\.diff-summary-chip\s*{([^}]+)}/);

  it('defines a .diff-summary-chip rule', () => {
    expect(ruleMatch, '.diff-summary-chip rule not found').not.toBeNull();
  });

  it('uses block layout, not inline-flex', () => {
    const body = ruleMatch![1];
    expect(body).toContain('display: block');
    expect(body).not.toContain('inline-flex');
  });
});
