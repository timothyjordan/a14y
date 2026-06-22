import { describe, it, expect } from 'vitest';
import { sanitizeProps } from '../src/core/sanitize';

// Adversarial test suite for sanitizeProps.
// Oracle derived solely from the behavioral spec and the type façade:
//   sanitizeProps(props: Record<string, unknown>): Record<string, EventParamValue>
//   EventParamValue = string | number | boolean
// sanitizeProps is a PRIVACY BOUNDARY: PII-shaped keys must never leak.

describe('sanitizeProps: IP-token keys are dropped', () => {
  it('drops standalone lowercase "ip"', () => {
    expect(sanitizeProps({ ip: '203.0.113.7' })).toEqual({});
  });

  it('drops standalone uppercase "IP" (case-insensitive)', () => {
    expect(sanitizeProps({ IP: '203.0.113.7' })).toEqual({});
  });

  it('drops "client_ip" (ip token after underscore)', () => {
    expect(sanitizeProps({ client_ip: '203.0.113.7' })).toEqual({});
  });

  it('drops "ip_address" (ip token before underscore)', () => {
    expect(sanitizeProps({ ip_address: '203.0.113.7' })).toEqual({});
  });

  it('drops "remote_ip"', () => {
    expect(sanitizeProps({ remote_ip: '203.0.113.7' })).toEqual({});
  });

  it('drops every IP-shaped key together, leaving only safe keys', () => {
    expect(
      sanitizeProps({
        ip: 'a',
        IP: 'b',
        client_ip: 'c',
        ip_address: 'd',
        remote_ip: 'e',
        safe_count: 3,
      }),
    ).toEqual({ safe_count: 3 });
  });

  it('drops mixed-case "Ip" / "iP" standalone tokens (case-insensitive)', () => {
    expect(sanitizeProps({ Ip: 'x' })).toEqual({});
    expect(sanitizeProps({ iP: 'x' })).toEqual({});
  });
});

describe('sanitizeProps: keys merely containing the letters "ip" survive (true negatives)', () => {
  it('keeps "description"', () => {
    expect(sanitizeProps({ description: 'hello' })).toEqual({ description: 'hello' });
  });

  it('keeps "shipping_mode"', () => {
    expect(sanitizeProps({ shipping_mode: 'air' })).toEqual({ shipping_mode: 'air' });
  });

  it('keeps "tooltip"', () => {
    expect(sanitizeProps({ tooltip: 't' })).toEqual({ tooltip: 't' });
  });

  it('keeps "recipe_id" with a numeric value', () => {
    expect(sanitizeProps({ recipe_id: 9 })).toEqual({ recipe_id: 9 });
  });

  it('keeps all four substring-"ip" keys at once, unchanged', () => {
    expect(
      sanitizeProps({ description: 'x', shipping_mode: 'air', tooltip: 't', recipe_id: 9 }),
    ).toEqual({ description: 'x', shipping_mode: 'air', tooltip: 't', recipe_id: 9 });
  });

  it('keeps "clientIp": no non-alphanumeric separator, so it is NOT an IP field', () => {
    // The "ip" here is embedded in camelCase with no delimiter, so the token
    // rule (standalone or delimited by non-alphanumeric separators) does not fire.
    expect(sanitizeProps({ clientIp: 'v' })).toEqual({ clientIp: 'v' });
  });
});

describe('sanitizeProps: other PII keys are dropped', () => {
  it('drops "url"', () => {
    expect(sanitizeProps({ url: 'https://x' })).toEqual({});
  });

  it('drops "href"', () => {
    expect(sanitizeProps({ href: 'https://x' })).toEqual({});
  });

  it('drops "host"', () => {
    expect(sanitizeProps({ host: 'example.com' })).toEqual({});
  });

  it('drops "email"', () => {
    expect(sanitizeProps({ email: 'a@b.com' })).toEqual({});
  });

  it('drops compound "page_url"', () => {
    expect(sanitizeProps({ page_url: 'https://x' })).toEqual({});
  });

  it('drops compound "user_email"', () => {
    expect(sanitizeProps({ user_email: 'a@b.com' })).toEqual({});
  });

  it('drops "page_url" and "user_email" together, returning {}', () => {
    expect(sanitizeProps({ page_url: 'x', user_email: 'y' })).toEqual({});
  });
});

describe('sanitizeProps: path-shaped keys', () => {
  it('drops standalone "path"', () => {
    expect(sanitizeProps({ path: '/a/b' })).toEqual({});
  });

  it('drops "file_path"', () => {
    expect(sanitizeProps({ file_path: '/a/b' })).toEqual({});
  });

  it('drops "path_segment"', () => {
    expect(sanitizeProps({ path_segment: 'b' })).toEqual({});
  });

  it('keeps the allowlisted "path_category"', () => {
    expect(sanitizeProps({ path_category: 'docs' })).toEqual({ path_category: 'docs' });
  });

  it('keeps "path_category" while dropping other path keys in the same call', () => {
    expect(
      sanitizeProps({ path: '/a', file_path: '/b', path_segment: 's', path_category: 'docs' }),
    ).toEqual({ path_category: 'docs' });
  });
});

describe('sanitizeProps: value coercion for valid primitives', () => {
  it('passes boolean true through unchanged', () => {
    expect(sanitizeProps({ flag: true })).toEqual({ flag: true });
  });

  it('passes boolean false through unchanged', () => {
    expect(sanitizeProps({ flag: false })).toEqual({ flag: false });
  });

  it('passes finite positive number through unchanged', () => {
    expect(sanitizeProps({ count: 42 })).toEqual({ count: 42 });
  });

  it('passes zero through unchanged', () => {
    expect(sanitizeProps({ count: 0 })).toEqual({ count: 0 });
  });

  it('passes finite negative and float numbers through unchanged', () => {
    expect(sanitizeProps({ a: -7, b: 3.14 })).toEqual({ a: -7, b: 3.14 });
  });

  it('passes a short string through unchanged', () => {
    expect(sanitizeProps({ note: 'hello' })).toEqual({ note: 'hello' });
  });

  it('passes a string of exactly 100 chars through unchanged', () => {
    const s = 'a'.repeat(100);
    expect(sanitizeProps({ note: s })).toEqual({ note: s });
  });
});

describe('sanitizeProps: string truncation to 100 chars', () => {
  it('truncates a 200-char string value to length 100', () => {
    const long = 'x'.repeat(200);
    const out = sanitizeProps({ note: long });
    expect(typeof out.note).toBe('string');
    expect((out.note as string).length).toBe(100);
  });

  it('truncated value is the first 100 characters of the input', () => {
    const long = 'x'.repeat(200);
    const out = sanitizeProps({ note: long });
    expect(out.note).toBe('x'.repeat(100));
  });

  it('truncates a 101-char string to exactly 100', () => {
    const s = 'b'.repeat(101);
    const out = sanitizeProps({ note: s });
    expect((out.note as string).length).toBe(100);
    expect(out.note).toBe('b'.repeat(100));
  });

  it('keeps an empty-string value (length 0 is within the 100 cap)', () => {
    expect(sanitizeProps({ note: '' })).toEqual({ note: '' });
  });
});

describe('sanitizeProps: invalid values are dropped', () => {
  it('drops null', () => {
    expect(sanitizeProps({ a: null })).toEqual({});
  });

  it('drops undefined', () => {
    expect(sanitizeProps({ a: undefined })).toEqual({});
  });

  it('drops NaN', () => {
    expect(sanitizeProps({ a: NaN })).toEqual({});
  });

  it('drops Infinity', () => {
    expect(sanitizeProps({ a: Infinity })).toEqual({});
  });

  it('drops -Infinity', () => {
    expect(sanitizeProps({ a: -Infinity })).toEqual({});
  });

  it('drops plain objects', () => {
    expect(sanitizeProps({ a: { nested: 1 } })).toEqual({});
  });

  it('drops arrays', () => {
    expect(sanitizeProps({ a: [1, 2, 3] })).toEqual({});
  });

  it('drops functions', () => {
    expect(sanitizeProps({ a: () => 1 })).toEqual({});
  });

  it('drops symbols', () => {
    expect(sanitizeProps({ a: Symbol('s') })).toEqual({});
  });

  it('drops invalid values while keeping valid siblings', () => {
    expect(
      sanitizeProps({
        good: 5,
        bad_null: null,
        bad_nan: NaN,
        bad_obj: {},
        also_good: 'ok',
      }),
    ).toEqual({ good: 5, also_good: 'ok' });
  });
});

describe('sanitizeProps: key-name length rules', () => {
  it('drops a key with an empty name', () => {
    expect(sanitizeProps({ '': 'v' })).toEqual({});
  });

  it('keeps a key of exactly 40 chars (boundary, inclusive)', () => {
    const key = 'k'.repeat(40);
    expect(sanitizeProps({ [key]: 'v' })).toEqual({ [key]: 'v' });
  });

  it('drops a key of 41 chars (just over the limit)', () => {
    const key = 'k'.repeat(41);
    expect(sanitizeProps({ [key]: 'v' })).toEqual({});
  });

  it('drops a key far longer than 40 chars', () => {
    const key = 'k'.repeat(100);
    expect(sanitizeProps({ [key]: 'v' })).toEqual({});
  });
});

describe('sanitizeProps: emits at most 25 parameters', () => {
  it('keeps all 25 when exactly 25 valid params are given', () => {
    const input: Record<string, unknown> = {};
    for (let i = 0; i < 25; i++) input[`k${i}`] = i;
    const out = sanitizeProps(input);
    expect(Object.keys(out).length).toBe(25);
  });

  it('caps output at 25 when 30 valid params are given', () => {
    const input: Record<string, unknown> = {};
    for (let i = 0; i < 30; i++) input[`k${i}`] = i;
    const out = sanitizeProps(input);
    expect(Object.keys(out).length).toBe(25);
  });

  it('caps output at 25 even with 100 valid params', () => {
    const input: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) input[`k${i}`] = i;
    const out = sanitizeProps(input);
    expect(Object.keys(out).length).toBe(25);
  });

  it('every emitted key/value under the cap was present in the input', () => {
    const input: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) input[`k${i}`] = i;
    const out = sanitizeProps(input);
    for (const [k, v] of Object.entries(out)) {
      expect(input[k]).toBe(v);
    }
  });
});

describe('sanitizeProps: purity and robustness', () => {
  it('returns an empty object for empty input', () => {
    expect(sanitizeProps({})).toEqual({});
  });

  it('does not mutate the input argument', () => {
    const input = { good: 1, ip: 'secret', note: 'x'.repeat(200), bad: null };
    const snapshot = JSON.parse(JSON.stringify(input));
    sanitizeProps(input);
    expect(input).toEqual(snapshot);
  });

  it('returns a new object distinct from the input reference', () => {
    const input = { good: 1 };
    const out = sanitizeProps(input);
    expect(out).not.toBe(input);
  });

  it('does not throw on a mix of valid, PII, and invalid entries', () => {
    expect(() =>
      sanitizeProps({
        good: 1,
        ip: 'x',
        url: 'y',
        path: '/z',
        bad: null,
        big: 'q'.repeat(500),
      }),
    ).not.toThrow();
  });

  it('combined drop-and-keep: only safe primitive entries survive', () => {
    const out = sanitizeProps({
      ip: '1.2.3.4',
      user_email: 'a@b.com',
      file_path: '/x',
      description: 'desc',
      count: 7,
      enabled: true,
      bad: null,
    });
    expect(out).toEqual({ description: 'desc', count: 7, enabled: true });
  });
});
