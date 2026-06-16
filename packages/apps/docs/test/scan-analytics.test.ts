import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyScanError,
  issueBucket,
  scoreBucket,
  trackEvent,
} from '~/lib/analytics';

describe('scoreBucket', () => {
  it('matches the @a14y/telemetry boundaries', () => {
    expect(scoreBucket(0)).toBe('0-25');
    expect(scoreBucket(25)).toBe('0-25');
    expect(scoreBucket(26)).toBe('26-50');
    expect(scoreBucket(50)).toBe('26-50');
    expect(scoreBucket(75)).toBe('51-75');
    expect(scoreBucket(76)).toBe('76-100');
    expect(scoreBucket(100)).toBe('76-100');
    expect(scoreBucket(NaN)).toBe('0-25');
  });
});

describe('issueBucket', () => {
  it('matches the @a14y/telemetry boundaries', () => {
    expect(issueBucket(0)).toBe('0');
    expect(issueBucket(2)).toBe('1-2');
    expect(issueBucket(5)).toBe('3-5');
    expect(issueBucket(10)).toBe('6-10');
    expect(issueBucket(11)).toBe('11+');
    expect(issueBucket(NaN)).toBe('0');
  });
});

describe('classifyScanError', () => {
  it('maps proxy / network / other and never returns the raw message', () => {
    expect(classifyScanError(new Error('scan proxy error 400: blocked host'))).toBe('proxy');
    expect(classifyScanError(new TypeError('Failed to fetch'))).toBe('network');
    expect(classifyScanError(new Error('something else'))).toBe('other');
    expect(classifyScanError('weird string')).toBe('other');
  });
});

describe('trackEvent', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('no-ops when window/gtag is absent (opted out)', () => {
    expect(() => trackEvent('scan_completed', { score_bucket: '0-25' })).not.toThrow();
  });

  it('calls gtag with app_name merged when available', () => {
    const calls: unknown[][] = [];
    (globalThis as { window?: unknown }).window = {
      gtag: (...args: unknown[]) => calls.push(args),
    };
    trackEvent('scan_completed', { score_bucket: '76-100', scorecard_version: '0.2.0' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      'event',
      'scan_completed',
      { app_name: 'docs', score_bucket: '76-100', scorecard_version: '0.2.0' },
    ]);
  });

  it('does not send a url param', () => {
    const params: Record<string, unknown>[] = [];
    (globalThis as { window?: unknown }).window = {
      gtag: (_c: unknown, _n: unknown, p: Record<string, unknown>) => params.push(p),
    };
    trackEvent('scan_completed', { score_bucket: '51-75', scorecard_version: '0.2.0' });
    const keys = Object.keys(params[0]);
    expect(keys.some((k) => /url|href|host/i.test(k))).toBe(false);
  });
});
