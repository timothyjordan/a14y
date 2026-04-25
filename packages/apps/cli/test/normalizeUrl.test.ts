import { describe, expect, it, vi } from 'vitest';
import { normalizeUrl, UnreachableUrlError } from '../src/normalizeUrl';

function makeResponse(status = 200): Response {
  return new Response(null, { status });
}

function connError(): Error {
  // Mirrors what undici / node fetch throws on DNS / TCP refused.
  const err = new TypeError('fetch failed');
  (err as { cause?: unknown }).cause = new Error('ENOTFOUND');
  return err;
}

describe('normalizeUrl', () => {
  it('passes through a URL that already has https://', async () => {
    const fetchImpl = vi.fn();
    const out = await normalizeUrl('https://example.com', { fetchImpl });
    expect(out).toEqual({ url: 'https://example.com/', rewrote: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('passes through a URL that already has http://', async () => {
    const fetchImpl = vi.fn();
    const out = await normalizeUrl('http://example.com/foo', { fetchImpl });
    expect(out).toEqual({ url: 'http://example.com/foo', rewrote: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('adds https:// to a bare hostname when https is reachable', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith('https://')) return makeResponse(200);
      throw connError();
    });
    const out = await normalizeUrl('timothyjordan.com', { fetchImpl });
    expect(out).toEqual({ url: 'https://timothyjordan.com/', rewrote: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://timothyjordan.com/');
  });

  it('falls back to http:// when https probe throws a connection error', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith('https://')) throw connError();
      return makeResponse(200);
    });
    const out = await normalizeUrl('legacy-only.test', { fetchImpl });
    expect(out).toEqual({ url: 'http://legacy-only.test/', rewrote: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('treats 4xx/5xx HTTP responses as reachable (host exists)', async () => {
    // Some servers reject HEAD with 405 or always 404 the root; that's
    // still a "host is up" signal and must not trigger the http fallback.
    const fetchImpl = vi.fn(async () => makeResponse(404));
    const out = await normalizeUrl('example.com', { fetchImpl });
    expect(out).toEqual({ url: 'https://example.com/', rewrote: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws UnreachableUrlError when both https and http fail', async () => {
    const fetchImpl = vi.fn(async () => {
      throw connError();
    });
    await expect(
      normalizeUrl('does-not-exist.invalid', { fetchImpl }),
    ).rejects.toBeInstanceOf(UnreachableUrlError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('preserves a path on a bare hostname', async () => {
    const fetchImpl = vi.fn(async () => makeResponse(200));
    const out = await normalizeUrl('example.com/docs/intro', { fetchImpl });
    expect(out.url).toBe('https://example.com/docs/intro');
    expect(out.rewrote).toBe(true);
  });

  it('handles host:port input by adding a scheme', async () => {
    const fetchImpl = vi.fn(async () => makeResponse(200));
    const out = await normalizeUrl('localhost:3000', { fetchImpl });
    expect(out.url).toBe('https://localhost:3000/');
    expect(out.rewrote).toBe(true);
  });

  it('error message names the original input and avoids "Invalid URL"', async () => {
    const fetchImpl = vi.fn(async () => {
      throw connError();
    });
    try {
      await normalizeUrl('does-not-exist.invalid', { fetchImpl });
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(UnreachableUrlError);
      const msg = (e as Error).message;
      expect(msg).toContain('does-not-exist.invalid');
      expect(msg).not.toContain('Invalid URL');
    }
  });
});
