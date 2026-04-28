import { describe, it, expect } from 'vitest';
import {
  sanitizeProps,
  errorClassName,
  isValidEventName,
} from '../src/core/sanitize';

describe('sanitizeProps', () => {
  it('drops PII-shaped keys', () => {
    expect(
      sanitizeProps({
        url: 'https://example.com',
        href: '/x',
        host: 'example.com',
        email: 'a@b.com',
        ip: '1.2.3.4',
        keep: 'me',
      }),
    ).toEqual({ keep: 'me' });
  });

  it('drops keys containing path but keeps path_category', () => {
    expect(
      sanitizeProps({
        path: '/a/b',
        page_path: '/x',
        path_category: 'home',
      }),
    ).toEqual({ path_category: 'home' });
  });

  it('keeps booleans, numbers, and strings; truncates long strings', () => {
    const longStr = 'x'.repeat(150);
    const out = sanitizeProps({ b: true, n: 42, s: 'short', long: longStr });
    expect(out).toEqual({ b: true, n: 42, s: 'short', long: 'x'.repeat(100) });
  });

  it('drops null, undefined, NaN, Infinity, objects, arrays', () => {
    expect(
      sanitizeProps({
        a: null,
        b: undefined,
        c: Number.NaN,
        d: Infinity,
        e: { nested: 1 },
        f: [1, 2],
        g: 'ok',
      }),
    ).toEqual({ g: 'ok' });
  });

  it('drops keys longer than 40 chars or empty keys', () => {
    const tooLong = 'a'.repeat(41);
    const ok = 'a'.repeat(40);
    const out = sanitizeProps({ '': 'x', [tooLong]: 'y', [ok]: 'z' });
    expect(out).toEqual({ [ok]: 'z' });
  });

  it('caps total params at 25', () => {
    const props: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) props[`p${i}`] = i;
    const out = sanitizeProps(props);
    expect(Object.keys(out)).toHaveLength(25);
  });
});

describe('errorClassName', () => {
  it('returns the constructor name for Error subclasses', () => {
    expect(errorClassName(new TypeError('x'))).toBe('TypeError');
    expect(errorClassName(new RangeError('x'))).toBe('RangeError');
  });
  it('returns Error for primitives and null', () => {
    expect(errorClassName(null)).toBe('Error');
    expect(errorClassName(undefined)).toBe('Error');
    expect(errorClassName('string error')).toBe('Error');
    expect(errorClassName(42)).toBe('Error');
  });
  it('returns the class name for custom errors', () => {
    class MyError extends Error {}
    expect(errorClassName(new MyError('x'))).toBe('MyError');
  });
});

describe('isValidEventName', () => {
  it.each([
    ['cli_run_completed', true],
    ['ext_audit_started', true],
    ['outbound_click', true],
    ['_starts_with_underscore', false],
    ['1starts_with_digit', false],
    ['has spaces', false],
    ['has-dash', false],
    ['', false],
    ['a'.repeat(40), true],
    ['a'.repeat(41), false],
  ])('isValidEventName(%s) === %s', (name, expected) => {
    expect(isValidEventName(name)).toBe(expected);
  });
});
