import { describe, it, expect } from 'vitest';
import { resolveAllowedOrigins, ALLOWED_ORIGINS, EXTRA_ORIGINS_ENV } from '../src/config';

/**
 * Property-style tests for `resolveAllowedOrigins`.
 *
 * Oracle is the spec for `config.ts`, not the implementation. Mode is
 * "property": we assert invariants across many deterministically-generated env
 * inputs rather than checking a single example. fast-check is not used; inputs
 * are enumerated from fixed candidate token pools so the run is reproducible.
 */

// A pool of candidate "extra origin" tokens. Some are guaranteed-novel
// (cannot collide with ALLOWED_ORIGINS by construction), some are blank-ish to
// exercise comma/whitespace handling. We add the hardcoded origins at runtime
// so the "already-listed" case is covered without hardcoding their values.
const NOVEL_TOKENS = [
  'http://localhost:4330',
  'http://a.test',
  'http://b.test',
  'https://novel.example',
  'garbage',
  'http://localhost:9999',
];

const BLANK_TOKENS = ['', ' ', '   '];

/** Deterministic enumeration helper: all k-length combinations (with order)
 *  drawn from `pool`, capped to keep the matrix bounded. */
function enumerateSequences(pool: string[], maxLen: number): string[][] {
  const out: string[][] = [[]];
  let frontier: string[][] = [[]];
  for (let len = 1; len <= maxLen; len++) {
    const next: string[][] = [];
    for (const seq of frontier) {
      for (const tok of pool) {
        next.push([...seq, tok]);
      }
    }
    out.push(...next);
    frontier = next;
  }
  return out;
}

/** Build a comma-separated env value from a token sequence, optionally with
 *  stray/leading/trailing commas to stress empty-entry dropping. */
function joinWithCommas(tokens: string[], variant: number): string {
  const base = tokens.join(',');
  switch (variant % 4) {
    case 0:
      return base;
    case 1:
      return ',' + base;
    case 2:
      return base + ',';
    default:
      return ',' + base + ',,';
  }
}

function membership(list: readonly string[]): Set<string> {
  return new Set(list);
}

// Candidate token pool that also includes the real hardcoded origins, so the
// generated env values can include "extras" that are already allow-listed.
const ALL_TOKENS = [...NOVEL_TOKENS, ...BLANK_TOKENS, ...ALLOWED_ORIGINS];

// A bounded but sizable set of generated env values.
const GENERATED_ENV_VALUES: string[] = (() => {
  const seqs = enumerateSequences(ALL_TOKENS, 2); // [], len1, len2
  const values: string[] = [];
  let variant = 0;
  for (const seq of seqs) {
    values.push(joinWithCommas(seq, variant));
    variant++;
  }
  return values;
})();

describe('resolveAllowedOrigins (property)', () => {
  it('ALLOWED_ORIGINS is always a subset of the result, for every generated env', () => {
    for (const raw of GENERATED_ENV_VALUES) {
      const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: raw });
      const resultSet = membership(result);
      for (const origin of ALLOWED_ORIGINS) {
        expect(resultSet.has(origin)).toBe(true);
      }
    }
  });

  it('the result never contains duplicates, for every generated env', () => {
    for (const raw of GENERATED_ENV_VALUES) {
      const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: raw });
      expect(result.length).toBe(new Set(result).size);
    }
  });

  it('with the env key absent, result membership equals ALLOWED_ORIGINS', () => {
    // No argument at all.
    const noArg = resolveAllowedOrigins();
    expect(membership(noArg)).toEqual(membership(ALLOWED_ORIGINS));

    // Env objects that lack PROXY_EXTRA_ORIGINS (but carry unrelated keys).
    const unrelatedEnvs: Array<{ [k: string]: string | undefined }> = [
      {},
      { SOME_OTHER_KEY: 'http://should.be.ignored' },
      { PATH: '/usr/bin', HOME: '/root' },
    ];
    for (const env of unrelatedEnvs) {
      const result = resolveAllowedOrigins(env);
      expect(membership(result)).toEqual(membership(ALLOWED_ORIGINS));
    }
  });

  it('adding only already-listed origins leaves result membership unchanged', () => {
    const baseline = membership(resolveAllowedOrigins());
    // Enumerate env values built solely from hardcoded origins (and blanks),
    // including duplicates and stray commas.
    const onlyListedPool = [...ALLOWED_ORIGINS, ...BLANK_TOKENS];
    const seqs = enumerateSequences(onlyListedPool, 2);
    let variant = 0;
    for (const seq of seqs) {
      const raw = joinWithCommas(seq, variant++);
      const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: raw });
      expect(membership(result)).toEqual(baseline);
    }
  });

  it('a novel extra origin is included in addition to the hardcoded list', () => {
    // Spec: when PROXY_EXTRA_ORIGINS is set, each parsed extra origin is
    // included in addition to ALLOWED_ORIGINS. Use a token guaranteed not to be
    // a hardcoded origin.
    const novel = NOVEL_TOKENS.filter((t) => !membership(ALLOWED_ORIGINS).has(t));
    for (const token of novel) {
      const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: token });
      const resultSet = membership(result);
      // Hardcoded list preserved...
      for (const origin of ALLOWED_ORIGINS) {
        expect(resultSet.has(origin)).toBe(true);
      }
      // ...plus the novel origin.
      expect(resultSet.has(token)).toBe(true);
    }
  });

  it('repeated extras collapse to a single entry', () => {
    const novel = NOVEL_TOKENS.filter((t) => !membership(ALLOWED_ORIGINS).has(t));
    for (const token of novel) {
      const raw = `${token},${token},${token}`;
      const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: raw });
      const occurrences = result.filter((o) => o === token).length;
      expect(occurrences).toBe(1);
    }
  });

  it('never throws and never mutates ALLOWED_ORIGINS, for every generated env', () => {
    const before = [...ALLOWED_ORIGINS];
    for (const raw of GENERATED_ENV_VALUES) {
      expect(() => resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: raw })).not.toThrow();
    }
    // Also exercise the no-arg and undefined-value paths.
    expect(() => resolveAllowedOrigins()).not.toThrow();
    expect(() => resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: undefined })).not.toThrow();

    // ALLOWED_ORIGINS unchanged in length and contents/order.
    expect(ALLOWED_ORIGINS.length).toBe(before.length);
    for (let i = 0; i < before.length; i++) {
      expect(ALLOWED_ORIGINS[i]).toBe(before[i]);
    }
  });

  it('an env value with only blanks/stray commas yields exactly ALLOWED_ORIGINS membership', () => {
    const blanks = ['', ',', ',,', ' , ', '   ', ',,,'];
    const baseline = membership(ALLOWED_ORIGINS);
    for (const raw of blanks) {
      const result = resolveAllowedOrigins({ [EXTRA_ORIGINS_ENV]: raw });
      expect(membership(result)).toEqual(baseline);
    }
  });
});
