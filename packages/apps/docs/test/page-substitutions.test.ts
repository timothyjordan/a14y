import { describe, expect, it } from 'vitest';
import {
  applyPageSubstitutions,
  getPageSubstitutions,
} from '../src/lib/page-substitutions';

describe('page substitutions', () => {
  it('exposes every documented token from the live scorecard', () => {
    const subs = getPageSubstitutions();
    expect(subs.LATEST_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(subs.RELEASED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number(subs.TOTAL_CHECKS)).toBeGreaterThan(0);
    expect(Number(subs.SITE_CHECK_COUNT)).toBeGreaterThanOrEqual(0);
    expect(Number(subs.PAGE_CHECK_COUNT)).toBeGreaterThanOrEqual(0);
    expect(
      Number(subs.SITE_CHECK_COUNT) + Number(subs.PAGE_CHECK_COUNT),
    ).toBe(Number(subs.TOTAL_CHECKS));
    expect(subs.LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('substitutes every {{TOKEN}} occurrence with its mapped value', () => {
    const out = applyPageSubstitutions('v{{LATEST_VERSION}} released {{RELEASED_AT}}', {
      LATEST_VERSION: '1.2.3',
      RELEASED_AT: '2026-01-15',
    });
    expect(out).toBe('v1.2.3 released 2026-01-15');
  });

  it('leaves unknown tokens intact rather than blanking them', () => {
    const out = applyPageSubstitutions('keep {{UNKNOWN}} verbatim', {
      LATEST_VERSION: '1.0.0',
    });
    expect(out).toBe('keep {{UNKNOWN}} verbatim');
  });

  it('handles repeated tokens', () => {
    const out = applyPageSubstitutions(
      '{{LATEST_VERSION}} and {{LATEST_VERSION}} and {{LATEST_VERSION}}',
      { LATEST_VERSION: '0.2.0' },
    );
    expect(out).toBe('0.2.0 and 0.2.0 and 0.2.0');
  });
});
