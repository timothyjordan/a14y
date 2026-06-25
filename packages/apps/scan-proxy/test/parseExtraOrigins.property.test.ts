import { describe, it, expect } from 'vitest';
import { parseExtraOrigins } from '../src/config';

/**
 * Property-style tests for `parseExtraOrigins(raw: string | undefined): string[]`.
 *
 * Oracle is the spec only (TJ-928 + config.ts docstrings):
 *  - undefined / '' yield [].
 *  - Comma-separated origins returned in order.
 *  - Surrounding whitespace on each entry is trimmed.
 *  - Empty entries (stray/leading/trailing/doubled commas) are dropped.
 *  - No validation/normalization: arbitrary tokens returned as-is.
 *  - Pure: does not mutate its argument; never reads process.env.
 *
 * fast-check is not installed, so inputs are generated deterministically from
 * fixed seeded arrays and an index-based pseudo-random whitespace picker.
 */

// A pool of non-blank "origin" tokens. The spec says tokens are NOT validated,
// so this mixes real-looking origins with arbitrary non-URL tokens.
const TOKEN_POOL: string[] = [
  'http://localhost:4330',
  'http://a.test',
  'http://b.test',
  'https://a14y.dev',
  'https://example.com:8443',
  'garbage',
  'not-a-url',
  'x',
  'HTTP://CASE.test',
  'http://localhost:9999',
];

// Whitespace fragments to sprinkle around tokens. Index 0 is "no whitespace".
const WS_POOL: string[] = ['', ' ', '  ', '\t', ' \t ', '\n', '   \t  '];

// Deterministic index-based pseudo-random in [0, n). No Math.random.
function seededIndex(seed: number, n: number): number {
  // A simple LCG-ish mixing of the seed, kept fully deterministic.
  const mixed = (seed * 1103515245 + 12345) >>> 0;
  return mixed % n;
}

// Build the set of token combinations to exercise: every singleton, plus a
// deterministic sweep of multi-token sequences.
function tokenSequences(): string[][] {
  const seqs: string[][] = [];

  // All singletons.
  for (const t of TOKEN_POOL) {
    seqs.push([t]);
  }

  // Deterministic multi-token sequences of varying lengths.
  for (let len = 2; len <= 5; len++) {
    for (let start = 0; start < TOKEN_POOL.length; start++) {
      const seq: string[] = [];
      for (let i = 0; i < len; i++) {
        const idx = seededIndex(start * 131 + i * 17 + len * 7, TOKEN_POOL.length);
        seq.push(TOKEN_POOL[idx]);
      }
      seqs.push(seq);
    }
  }

  return seqs;
}

// Given a sequence of (already-trimmed, non-blank) tokens, produce a raw string
// by joining with commas and sprinkling seeded whitespace around each token.
// The returned tokens are guaranteed to be the trimmed, in-order expectation.
function buildRaw(tokens: string[], seed: number): string {
  return tokens
    .map((tok, i) => {
      const before = WS_POOL[seededIndex(seed + i * 3, WS_POOL.length)];
      const after = WS_POOL[seededIndex(seed + i * 3 + 1, WS_POOL.length)];
      return `${before}${tok}${after}`;
    })
    .join(',');
}

describe('parseExtraOrigins — spec claims', () => {
  it('undefined yields []', () => {
    expect(parseExtraOrigins(undefined)).toEqual([]);
  });

  it("'' (empty string) yields []", () => {
    expect(parseExtraOrigins('')).toEqual([]);
  });

  it("a single origin yields that origin", () => {
    expect(parseExtraOrigins('http://localhost:4330')).toEqual([
      'http://localhost:4330',
    ]);
  });

  it('comma-separated origins are returned in order', () => {
    expect(parseExtraOrigins('http://a.test,http://b.test')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('surrounding whitespace on each entry is trimmed', () => {
    expect(parseExtraOrigins(' http://a.test , http://b.test ')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('empty entries from stray/trailing commas are dropped', () => {
    expect(parseExtraOrigins('http://a.test,,')).toEqual(['http://a.test']);
  });

  it("',,' yields []", () => {
    expect(parseExtraOrigins(',,')).toEqual([]);
  });

  it('non-URL tokens are returned as-is (no validation)', () => {
    expect(parseExtraOrigins('garbage')).toEqual(['garbage']);
  });
});

describe('parseExtraOrigins — properties over generated inputs', () => {
  const sequences = tokenSequences();

  it('result is always an array of strings', () => {
    let seed = 1;
    for (const seq of sequences) {
      const raw = buildRaw(seq, seed++);
      const result = parseExtraOrigins(raw);
      expect(Array.isArray(result)).toBe(true);
      for (const el of result) {
        expect(typeof el).toBe('string');
      }
    }
  });

  it('every element is non-empty and equals its own trim (no surrounding whitespace)', () => {
    let seed = 1000;
    for (const seq of sequences) {
      const raw = buildRaw(seq, seed++);
      const result = parseExtraOrigins(raw);
      for (const el of result) {
        expect(el.length).toBeGreaterThan(0);
        expect(el).toBe(el.trim());
      }
    }
  });

  it('count of results equals count of non-blank comma-separated segments', () => {
    let seed = 2000;
    for (const seq of sequences) {
      const raw = buildRaw(seq, seed++);
      // Every token in `seq` came from the pool (all non-blank, already trimmed),
      // so each contributes exactly one non-blank segment.
      const expectedCount = seq.length;
      const result = parseExtraOrigins(raw);
      expect(result.length).toBe(expectedCount);
    }
  });

  it('order is preserved (trimmed tokens come back in input order)', () => {
    let seed = 3000;
    for (const seq of sequences) {
      const raw = buildRaw(seq, seed++);
      const result = parseExtraOrigins(raw);
      expect(result).toEqual(seq);
    }
  });

  it('blank segments from doubled/leading/trailing commas are dropped, real ones preserved in order', () => {
    let seed = 4000;
    for (const seq of sequences) {
      const raw = buildRaw(seq, seed++);
      // Inject leading, trailing, and interior empty segments.
      const polluted = `,${raw},,`.replace(/,/g, (m, offset) =>
        // Sprinkle a doubled comma at a deterministic interior point too.
        offset === Math.floor(raw.length / 2) ? ',,' : m,
      );
      const result = parseExtraOrigins(polluted);
      expect(result).toEqual(seq);
    }
  });

  it('never mutates its input (string args are immutable, but the reference is unchanged)', () => {
    let seed = 5000;
    for (const seq of sequences) {
      const raw = buildRaw(seq, seed++);
      const before = raw;
      parseExtraOrigins(raw);
      // Strings are immutable in JS; this guards against any spec-violating
      // surprise where the same reference reports a changed value.
      expect(raw).toBe(before);
    }
  });

  it('never throws for any string input', () => {
    const weirdInputs = [
      '',
      ',',
      ',,',
      ',,,',
      '   ',
      ' , , ',
      '\t\n',
      'a',
      'a,b,c',
      ',a,',
      'a,,b',
      '   a   ,   b   ',
      'http://x,,,,http://y',
      'garbage,,,more-garbage',
    ];
    for (const input of weirdInputs) {
      expect(() => parseExtraOrigins(input)).not.toThrow();
      const result = parseExtraOrigins(input);
      expect(Array.isArray(result)).toBe(true);
    }
    // Plus the full generated sweep should never throw either.
    let seed = 6000;
    for (const seq of sequences) {
      const raw = buildRaw(seq, seed++);
      expect(() => parseExtraOrigins(raw)).not.toThrow();
    }
  });

  it('all-blank inputs (only commas/whitespace) yield []', () => {
    const blanks = ['', ' ', ',', ',,', ',,,', '  ,  ,  ', '\t,\n', '   '];
    for (const input of blanks) {
      expect(parseExtraOrigins(input)).toEqual([]);
    }
  });
});
