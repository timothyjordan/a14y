import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '~/lib/scan/run-scan';

describe('normalizeUrl', () => {
  it('adds https:// when the scheme is missing', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com/');
    expect(normalizeUrl('example.com/docs')).toBe('https://example.com/docs');
  });

  it('keeps an explicit scheme', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/');
    expect(normalizeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com/');
  });

  it('returns null for empty input', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
  });

  it('returns null for a hostname without a dot', () => {
    expect(normalizeUrl('localhost')).toBeNull();
    expect(normalizeUrl('just-text')).toBeNull();
  });

  it('returns null for unsupported schemes', () => {
    expect(normalizeUrl('ftp://example.com')).toBeNull();
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
  });
});
