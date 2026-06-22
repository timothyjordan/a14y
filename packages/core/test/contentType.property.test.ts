import { describe, it, expect } from 'vitest';
import { looksLikeHtml } from '../src/checks/site/_contentType';

/**
 * Property-based tests for `looksLikeHtml(body, contentType?)`.
 *
 * fast-check is NOT available in this repo, so generative coverage is driven by
 * a seeded inline PRNG (mulberry32). Every property runs a fixed number of
 * deterministic iterations from a fixed seed, so runs are fully reproducible.
 *
 * The oracle comes ONLY from the spec:
 *   - Returns boolean for any string body / (string|undefined) contentType.
 *   - HTML-document bodies (after BOM, leading whitespace, and a single leading
 *     HTML comment) starting with <!doctype html | <html | <head | <body
 *     (case-insensitive) are HTML => true, regardless of contentType.
 *   - Real markdown/text files whose first non-whitespace char is NOT `<` are
 *     not HTML => false when contentType is non-HTML or omitted.
 *
 * Generators are kept strictly inside the clearly-specified regions so the
 * "true" region and the "false" region never overlap an ambiguous case.
 */

const ITERATIONS = 400;
const SEED = 0x9e3779b9;

// --- Seeded PRNG (mulberry32) -------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed: number) {
  const next = mulberry32(seed);
  return {
    next,
    int(maxExclusive: number): number {
      return Math.floor(next() * maxExclusive);
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(next() * arr.length)];
    },
    bool(): boolean {
      return next() < 0.5;
    },
  };
}

type Rng = ReturnType<typeof makeRng>;

// --- Shared character pools ---------------------------------------------------
const ARBITRARY_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \t\n\r.,;:!?/\\-_=+*&^%$#@()[]{}"\'`~|';

function randomText(rng: Rng, maxLen: number): string {
  const len = rng.int(maxLen + 1);
  let out = '';
  for (let i = 0; i < len; i++) out += rng.pick(ARBITRARY_CHARS.split(''));
  return out;
}

// Randomly upper/lower-case a literal token, preserving non-letters.
function randomCase(rng: Rng, token: string): string {
  let out = '';
  for (const ch of token) {
    if (/[a-z]/i.test(ch)) out += rng.bool() ? ch.toUpperCase() : ch.toLowerCase();
    else out += ch;
  }
  return out;
}

const WHITESPACE = [' ', '\t', '\n', '\r'];
function randomWhitespace(rng: Rng, max: number): string {
  const n = rng.int(max + 1);
  let out = '';
  for (let i = 0; i < n; i++) out += rng.pick(WHITESPACE);
  return out;
}

const BOM = '﻿';

// Non-HTML content types (and undefined), per spec: anything that isn't
// text/html or application/xhtml+xml.
const NON_HTML_CONTENT_TYPES: (string | undefined)[] = [
  undefined,
  'text/plain',
  'text/markdown',
  'text/plain; charset=utf-8',
  'application/json',
  'application/octet-stream',
  'text/x-markdown',
  '',
];

// Any content type at all (HTML and non-HTML), for the "always boolean" prop.
const ANY_CONTENT_TYPES: (string | undefined)[] = [
  ...NON_HTML_CONTENT_TYPES,
  'text/html',
  'text/html; charset=utf-8',
  'application/xhtml+xml',
  'application/xhtml+xml; charset=utf-8',
];

// HTML document openers per spec.
const HTML_OPENERS = ['<!doctype html', '<html', '<head', '<body'];

// First chars for clearly-non-`<` real files (markdown / text / robots / link).
const NON_BRACKET_STARTERS = ['#', 'U', 'H', '[', 'a', 'z', 'A', 'Z', '0', '9', '-', '*'];

// --- Generators ---------------------------------------------------------------

/** Generate a body that the spec classifies as an HTML document. */
function genHtmlBody(rng: Rng): string {
  let prefix = '';
  if (rng.bool()) prefix += BOM; // optional leading BOM
  prefix += randomWhitespace(rng, 5); // optional leading whitespace
  // optional single leading HTML comment (then more optional whitespace)
  if (rng.bool()) {
    const commentBody = randomText(rng, 12).replace(/-->/g, 'xx'); // avoid early close
    prefix += `<!--${commentBody}-->`;
    prefix += randomWhitespace(rng, 5);
  }
  const opener = randomCase(rng, rng.pick(HTML_OPENERS));
  const trailing = randomText(rng, 40);
  return prefix + opener + trailing;
}

/**
 * Generate a real text/markdown body whose first non-whitespace char is a
 * clearly-non-`<` starter, and which contains NO leading html marker. We keep
 * the entire body free of a leading `<` so it can never be sniffed as HTML.
 */
function genRealFileBody(rng: Rng): string {
  // optional BOM + leading whitespace, then a definite non-`<` first char.
  let body = '';
  if (rng.bool()) body += BOM;
  body += randomWhitespace(rng, 4);
  const first = rng.pick(NON_BRACKET_STARTERS);
  body += first;
  // Arbitrary trailing text with all `<` stripped so no html marker can appear.
  const rest = randomText(rng, 60).replace(/</g, '');
  body += rest;
  return body;
}

/** Fully arbitrary body for the "always returns boolean" property. */
function genArbitraryBody(rng: Rng): string {
  // Mix: sometimes empty, sometimes whitespace, sometimes random, sometimes
  // structured html/real bodies, so the "never throws" claim is well exercised.
  const kind = rng.int(5);
  switch (kind) {
    case 0:
      return '';
    case 1:
      return randomWhitespace(rng, 8);
    case 2:
      return genHtmlBody(rng);
    case 3:
      return genRealFileBody(rng);
    default:
      return randomText(rng, 80);
  }
}

// --- Properties ---------------------------------------------------------------

describe('looksLikeHtml — property based (seeded, no fast-check)', () => {
  it('Property 1: always returns a boolean and never throws for any body/contentType', () => {
    const rng = makeRng(SEED ^ 0x0000001);
    for (let i = 0; i < ITERATIONS; i++) {
      const body = genArbitraryBody(rng);
      const ct = rng.pick(ANY_CONTENT_TYPES);
      let result: unknown;
      expect(() => {
        result = looksLikeHtml(body, ct);
      }, `threw on iteration ${i} (ct=${String(ct)})`).not.toThrow();
      expect(
        typeof result,
        `not boolean on iteration ${i} (ct=${String(ct)})`,
      ).toBe('boolean');
    }
  });

  it('Property 2: any HTML document body is true regardless of contentType', () => {
    const rng = makeRng(SEED ^ 0x0000002);
    for (let i = 0; i < ITERATIONS; i++) {
      const body = genHtmlBody(rng);
      const ct = rng.pick(ANY_CONTENT_TYPES); // HTML or not — must not matter
      expect(
        looksLikeHtml(body, ct),
        `expected true (html body) on iteration ${i}: body=${JSON.stringify(
          body,
        )} ct=${String(ct)}`,
      ).toBe(true);
    }
  });

  it('Property 3: a real non-`<` file is false when contentType is non-HTML or omitted', () => {
    const rng = makeRng(SEED ^ 0x0000003);
    for (let i = 0; i < ITERATIONS; i++) {
      const body = genRealFileBody(rng);
      const ct = rng.pick(NON_HTML_CONTENT_TYPES); // includes undefined
      expect(
        looksLikeHtml(body, ct),
        `expected false (real file) on iteration ${i}: body=${JSON.stringify(
          body,
        )} ct=${String(ct)}`,
      ).toBe(false);
    }
  });

  it('Property 4: pure / idempotent — same args yield the same result', () => {
    const rng = makeRng(SEED ^ 0x0000004);
    for (let i = 0; i < ITERATIONS; i++) {
      const body = genArbitraryBody(rng);
      const ct = rng.pick(ANY_CONTENT_TYPES);
      const a = looksLikeHtml(body, ct);
      const b = looksLikeHtml(body, ct);
      expect(typeof a).toBe('boolean');
      expect(
        b,
        `non-idempotent on iteration ${i}: body=${JSON.stringify(
          body,
        )} ct=${String(ct)}`,
      ).toBe(a);
    }
  });
});
