import { describe, it, expect } from 'vitest';
import { sanitizeProps } from '../src/core/sanitize';

/**
 * PROPERTY-BASED tests for sanitizeProps, written clean-room from the spec only.
 *
 * fast-check is NOT available in this workspace, so these are deterministic
 * generative tests: a seeded inline PRNG drives many randomized-but-reproducible
 * inputs, and each invariant is asserted as a universally-quantified property.
 *
 * Spec invariants encoded here:
 *  - Output keys are a subset of input keys (no invented keys).
 *  - No output key carries an IP token (standalone or delimited by
 *    non-alphanumerics, case-insensitive), and none contains url/href/host/email.
 *  - Keys that merely contain "ip" inside a word (alnum on both sides) survive
 *    when their value is a valid primitive.
 *  - All output values are GA4 primitives: string | number | boolean, numbers
 *    finite, strings length <= 100.
 *  - Output never has more than 25 keys.
 *  - Never throws on records of valid primitive values; never mutates the input.
 */

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) for reproducible "random" generation.
// ---------------------------------------------------------------------------
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

const RUNS = 600;

function makeRng(seed: number) {
  const rand = mulberry32(seed);
  const int = (maxExclusive: number) => Math.floor(rand() * maxExclusive);
  const pick = <T>(arr: readonly T[]): T => arr[int(arr.length)];
  return { rand, int, pick };
}

type Rng = ReturnType<typeof makeRng>;

// ---------------------------------------------------------------------------
// Key generators.
// ---------------------------------------------------------------------------

// "ip" standalone / delimited by non-alphanumerics -> must be dropped.
const IP_KEYS: readonly string[] = [
  'ip',
  'IP',
  'Ip',
  'iP',
  'client_ip',
  'ip_address',
  'remote_ip',
  'IP_ADDRESS',
  'user.ip',
  'ip-addr',
  'src ip',
  'ip|v4',
  'server_IP_addr',
];

// Other PII substrings -> must be dropped.
const PII_SUBSTR_KEYS: readonly string[] = [
  'url',
  'page_url',
  'href',
  'link_href',
  'host',
  'hostname',
  'email',
  'user_email',
  'EMAIL',
  'PageURL',
  'referrer_HOST',
];

// "ip" buried inside a word with alphanumerics on both sides -> retained
// (when value is a valid primitive). Kept free of url/href/host/email and
// of any other dropping rule, length <= 40, non-empty, no path token.
const KEEP_KEYS: readonly string[] = [
  'description',
  'shipping_mode',
  'tooltip',
  'recipe_id',
  'zipcode',
  'flagship',
  'chip_set',
  'script_name',
];

function randomAlphaWord(rng: Rng, len: number): string {
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  let s = '';
  for (let i = 0; i < len; i++) s += alpha[rng.int(alpha.length)];
  return s;
}

// A word that contains "ip" strictly inside, with alpha neighbors on both
// sides, and contains none of the forbidden substrings -> should be kept.
function genInsideIpWord(rng: Rng): string {
  const before = randomAlphaWord(rng, 1 + rng.int(6));
  const after = randomAlphaWord(rng, 1 + rng.int(6));
  let candidate = `${before}ip${after}`;
  // Guard against accidentally producing a forbidden substring or being too long.
  const lower = candidate.toLowerCase();
  if (
    lower.includes('url') ||
    lower.includes('href') ||
    lower.includes('host') ||
    lower.includes('email') ||
    lower.includes('path') ||
    candidate.length === 0 ||
    candidate.length > 40
  ) {
    return 'recipe'; // safe fallback, "ip" inside a word
  }
  return candidate;
}

// A generally "ordinary" safe key (no PII tokens, <=40 chars, non-empty,
// no path token, no standalone ip).
const ORDINARY_KEYS: readonly string[] = [
  'event_name',
  'count',
  'enabled',
  'label',
  'category',
  'value',
  'duration_ms',
  'screen',
  'variant',
  'mode',
];

// ---------------------------------------------------------------------------
// Value generators (valid GA4-coercible primitives only, per "valid primitive
// values" framing for the no-throw / no-mutation properties).
// ---------------------------------------------------------------------------
function genValidPrimitive(rng: Rng): string | number | boolean {
  const kind = rng.int(3);
  if (kind === 0) {
    // string of varied length, including > 100 to exercise truncation.
    const len = rng.int(220);
    return randomAlphaWord(rng, len);
  }
  if (kind === 1) {
    // finite number
    const sign = rng.rand() < 0.5 ? -1 : 1;
    return sign * rng.rand() * 1e6;
  }
  return rng.rand() < 0.5;
}

// ---------------------------------------------------------------------------
// Record builder.
// ---------------------------------------------------------------------------
function genRecord(rng: Rng): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const n = rng.int(40); // 0..39 entries, exercises the 25-cap.
  for (let i = 0; i < n; i++) {
    const bucket = rng.int(6);
    let key: string;
    switch (bucket) {
      case 0:
        key = rng.pick(IP_KEYS);
        break;
      case 1:
        key = rng.pick(PII_SUBSTR_KEYS);
        break;
      case 2:
        key = rng.pick(KEEP_KEYS);
        break;
      case 3:
        key = genInsideIpWord(rng);
        break;
      default:
        key = rng.pick(ORDINARY_KEYS);
        break;
    }
    // Disambiguate occasional collisions so different buckets do not clobber
    // each other in this single literal. Append a non-alphanumeric? No: that
    // could change ip semantics. Use an index suffix only for ordinary/keep
    // keys, joined by a letter to keep alnum-internal semantics intact.
    out[key] = genValidPrimitive(rng);
  }
  return out;
}

// Deep clone for mutation checks (inputs are records of primitives).
function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// PII-key detector derived strictly from the spec wording.
function hasIpToken(key: string): boolean {
  // "ip" standalone or delimited by non-alphanumerics, case-insensitive.
  // i.e. an "ip" occurrence whose neighbors are not alphanumeric.
  return /(^|[^a-z0-9])ip([^a-z0-9]|$)/i.test(key);
}
function hasPiiSubstring(key: string): boolean {
  return /(url|href|host|email)/i.test(key);
}

// ---------------------------------------------------------------------------
// Properties.
// ---------------------------------------------------------------------------
describe('sanitizeProps (property-based, seeded)', () => {
  it('output keys are always a subset of input keys (no invented keys)', () => {
    for (let s = 1; s <= RUNS; s++) {
      const rng = makeRng(s * 2654435761);
      const input = genRecord(rng);
      const inputKeys = new Set(Object.keys(input));
      const out = sanitizeProps(deepClone(input));
      for (const k of Object.keys(out)) {
        expect(inputKeys.has(k)).toBe(true);
      }
    }
  });

  it('never emits a key carrying an IP token or url/href/host/email', () => {
    for (let s = 1; s <= RUNS; s++) {
      const rng = makeRng(s * 40503 + 7);
      const input = genRecord(rng);
      const out = sanitizeProps(deepClone(input));
      for (const k of Object.keys(out)) {
        expect(hasIpToken(k)).toBe(false);
        expect(hasPiiSubstring(k)).toBe(false);
      }
    }
  });

  it('keys with "ip" inside a word are retained when value is a valid primitive', () => {
    for (let s = 1; s <= RUNS; s++) {
      const rng = makeRng(s * 9176 + 13);
      const key = genInsideIpWord(rng);
      const value = genValidPrimitive(rng);
      const out = sanitizeProps({ [key]: value });
      // Sanity: this generated key must not trip any PII rule (else the test
      // would be asserting against the wrong invariant).
      expect(hasIpToken(key)).toBe(false);
      expect(hasPiiSubstring(key)).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(out, key)).toBe(true);
    }
  });

  it('explicitly drops standalone/delimited IP keys (acceptance examples)', () => {
    for (const k of IP_KEYS) {
      const out = sanitizeProps({ [k]: '203.0.113.7' });
      expect(Object.prototype.hasOwnProperty.call(out, k)).toBe(false);
    }
  });

  it('explicitly drops url/href/host/email keys (acceptance examples)', () => {
    for (const k of PII_SUBSTR_KEYS) {
      const out = sanitizeProps({ [k]: 'value' });
      expect(Object.prototype.hasOwnProperty.call(out, k)).toBe(false);
    }
  });

  it('all output values are finite GA4 primitives with strings <= 100 chars', () => {
    for (let s = 1; s <= RUNS; s++) {
      const rng = makeRng(s * 22695477 + 1);
      const input = genRecord(rng);
      const out = sanitizeProps(deepClone(input));
      for (const v of Object.values(out)) {
        const t = typeof v;
        expect(t === 'string' || t === 'number' || t === 'boolean').toBe(true);
        if (t === 'number') {
          expect(Number.isFinite(v as number)).toBe(true);
        }
        if (t === 'string') {
          expect((v as string).length).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('output never has more than 25 keys', () => {
    for (let s = 1; s <= RUNS; s++) {
      const rng = makeRng(s * 1103515245 + 12345);
      const input = genRecord(rng);
      const out = sanitizeProps(deepClone(input));
      expect(Object.keys(out).length).toBeLessThanOrEqual(25);
    }
  });

  it('never throws on records of valid primitive values', () => {
    for (let s = 1; s <= RUNS; s++) {
      const rng = makeRng(s * 31337 + 5);
      const input = genRecord(rng);
      expect(() => sanitizeProps(deepClone(input))).not.toThrow();
    }
  });

  it('never mutates its input argument', () => {
    for (let s = 1; s <= RUNS; s++) {
      const rng = makeRng(s * 48271 + 3);
      const input = genRecord(rng);
      const before = deepClone(input);
      sanitizeProps(input);
      expect(input).toEqual(before);
    }
  });
});
