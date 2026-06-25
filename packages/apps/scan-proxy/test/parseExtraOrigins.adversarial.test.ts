import { describe, it, expect } from 'vitest';
import { parseExtraOrigins } from '../src/config';

describe('parseExtraOrigins (adversarial)', () => {
  it('returns [] for undefined', () => {
    expect(parseExtraOrigins(undefined)).toEqual([]);
  });

  it('returns [] for the empty string', () => {
    expect(parseExtraOrigins('')).toEqual([]);
  });

  it('returns a single origin unchanged', () => {
    expect(parseExtraOrigins('http://localhost:4330')).toEqual([
      'http://localhost:4330',
    ]);
  });

  it('returns comma-separated origins in order', () => {
    expect(parseExtraOrigins('http://a.test,http://b.test')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('trims surrounding whitespace on each entry', () => {
    expect(parseExtraOrigins(' http://a.test , http://b.test ')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('drops empty entries from trailing/doubled commas', () => {
    expect(parseExtraOrigins('http://a.test,,')).toEqual(['http://a.test']);
  });

  it('returns [] when the input is only commas', () => {
    expect(parseExtraOrigins(',,')).toEqual([]);
  });

  it('passes a non-URL token through as-is (no validation/normalization)', () => {
    expect(parseExtraOrigins('garbage')).toEqual(['garbage']);
  });

  it('does not mutate its argument', () => {
    const raw = ' http://a.test , http://b.test ';
    parseExtraOrigins(raw);
    expect(raw).toBe(' http://a.test , http://b.test ');
  });

  it('is pure with respect to process.env: the PROXY_EXTRA_ORIGINS env var does not affect the result', () => {
    const key = 'PROXY_EXTRA_ORIGINS';
    const had = Object.prototype.hasOwnProperty.call(process.env, key);
    const prev = process.env[key];
    process.env[key] = 'http://injected.test';
    try {
      // Result must derive only from the argument, never from process.env.
      expect(parseExtraOrigins(undefined)).toEqual([]);
      expect(parseExtraOrigins('http://a.test')).toEqual(['http://a.test']);
    } finally {
      if (had) {
        process.env[key] = prev;
      } else {
        delete process.env[key];
      }
    }
  });
});
