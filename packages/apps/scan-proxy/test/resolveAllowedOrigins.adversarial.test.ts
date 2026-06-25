import { describe, it, expect } from 'vitest';
import {
  resolveAllowedOrigins,
  ALLOWED_ORIGINS,
  EXTRA_ORIGINS_ENV,
} from '../src/config';

// Adversarial tests for resolveAllowedOrigins.
// Oracle is the spec (TJ-928 / config.ts CORS contract), not the implementation.
// We reference ALLOWED_ORIGINS and EXTRA_ORIGINS_ENV via the imported values so
// these assertions stay correct if the hardcoded base list changes.

/** Set-equality helper: same membership regardless of order or duplicates. */
function sameMembership(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

describe('resolveAllowedOrigins (adversarial)', () => {
  describe('security-critical default: absent opt-in allows nothing extra', () => {
    it('with no argument, the result equals ALLOWED_ORIGINS exactly (same membership)', () => {
      const result = resolveAllowedOrigins();
      expect(sameMembership(result, ALLOWED_ORIGINS)).toBe(true);
    });

    it('with an empty env object (no key), the result equals ALLOWED_ORIGINS exactly', () => {
      const result = resolveAllowedOrigins({});
      expect(sameMembership(result, ALLOWED_ORIGINS)).toBe(true);
    });

    it('with an env object that lacks PROXY_EXTRA_ORIGINS, the result equals ALLOWED_ORIGINS exactly', () => {
      const result = resolveAllowedOrigins({
        SOME_OTHER_KEY: 'http://evil.test',
        NODE_ENV: 'development',
      });
      expect(sameMembership(result, ALLOWED_ORIGINS)).toBe(true);
    });

    it('default result does not introduce any origin outside ALLOWED_ORIGINS', () => {
      const result = resolveAllowedOrigins();
      const base = new Set(ALLOWED_ORIGINS);
      for (const origin of result) {
        expect(base.has(origin)).toBe(true);
      }
    });
  });

  describe('every hardcoded origin is always present', () => {
    it('contains every ALLOWED_ORIGINS entry when no env is provided', () => {
      const result = new Set(resolveAllowedOrigins());
      for (const origin of ALLOWED_ORIGINS) {
        expect(result.has(origin)).toBe(true);
      }
    });

    it('contains every ALLOWED_ORIGINS entry even when extras are supplied', () => {
      const result = new Set(
        resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: 'http://localhost:4330' }),
      );
      for (const origin of ALLOWED_ORIGINS) {
        expect(result.has(origin)).toBe(true);
      }
    });
  });

  describe('setting the env key adds the extra origins', () => {
    it('includes a single extra origin in addition to the hardcoded list', () => {
      const extra = 'http://localhost:4330';
      const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: extra });
      expect(result).toContain(extra);
      for (const origin of ALLOWED_ORIGINS) {
        expect(result).toContain(origin);
      }
    });

    it('includes multiple comma-separated extra origins', () => {
      const result = resolveAllowedOrigins({
        [EXTRA_ORIGINS_ENV]: 'http://a.test,http://b.test',
      });
      expect(result).toContain('http://a.test');
      expect(result).toContain('http://b.test');
      for (const origin of ALLOWED_ORIGINS) {
        expect(result).toContain(origin);
      }
    });

    it('result with one fresh extra has exactly the base entries plus that one extra (membership)', () => {
      const extra = 'http://localhost:4330';
      // Guard: only meaningful if the extra is genuinely not already hardcoded.
      if (!new Set(ALLOWED_ORIGINS).has(extra)) {
        const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: extra });
        expect(sameMembership(result, [...ALLOWED_ORIGINS, extra])).toBe(true);
      }
    });
  });

  describe('de-duplication', () => {
    it('an extra equal to a hardcoded origin does not appear twice', () => {
      const existing = ALLOWED_ORIGINS[0];
      const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: existing });
      const occurrences = result.filter((o) => o === existing).length;
      expect(occurrences).toBe(1);
    });

    it('an extra equal to a hardcoded origin leaves membership unchanged', () => {
      const existing = ALLOWED_ORIGINS[0];
      const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: existing });
      expect(sameMembership(result, ALLOWED_ORIGINS)).toBe(true);
    });

    it('repeated identical extras collapse to a single entry', () => {
      const extra = 'http://localhost:4330';
      const result = resolveAllowedOrigins({
        [EXTRA_ORIGINS_ENV]: `${extra},${extra},${extra}`,
      });
      const occurrences = result.filter((o) => o === extra).length;
      expect(occurrences).toBe(1);
    });

    it('the entire result contains no duplicate origins', () => {
      const result = resolveAllowedOrigins({
        [EXTRA_ORIGINS_ENV]: `http://a.test,http://a.test,${ALLOWED_ORIGINS[0]}`,
      });
      expect(new Set(result).size).toBe(result.length);
    });
  });

  describe('only PROXY_EXTRA_ORIGINS is consulted', () => {
    it('ignores other env keys that look like origin lists', () => {
      const result = resolveAllowedOrigins({
        PROXY_ORIGINS: 'http://evil.test',
        EXTRA_ORIGINS: 'http://evil2.test',
        ORIGINS: 'http://evil3.test',
        ALLOWED_ORIGINS: 'http://evil4.test',
      });
      expect(result).not.toContain('http://evil.test');
      expect(result).not.toContain('http://evil2.test');
      expect(result).not.toContain('http://evil3.test');
      expect(result).not.toContain('http://evil4.test');
      expect(sameMembership(result, ALLOWED_ORIGINS)).toBe(true);
    });

    it('consults only EXTRA_ORIGINS_ENV when both it and decoy keys are present', () => {
      const result = resolveAllowedOrigins({
        [EXTRA_ORIGINS_ENV]: 'http://wanted.test',
        DECOY: 'http://decoy.test',
      });
      expect(result).toContain('http://wanted.test');
      expect(result).not.toContain('http://decoy.test');
    });

    it('EXTRA_ORIGINS_ENV is the literal PROXY_EXTRA_ORIGINS key', () => {
      expect(EXTRA_ORIGINS_ENV).toBe('PROXY_EXTRA_ORIGINS');
    });
  });
});
