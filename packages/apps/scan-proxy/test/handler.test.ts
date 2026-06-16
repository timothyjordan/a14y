import { describe, it, expect } from 'vitest';
import { handleProxy } from '../src/handler';

const ORIGIN = 'https://a14y.dev';

function req(
  target: string | null,
  opts: { method?: string; origin?: string | null; path?: string } = {},
): Request {
  const path = opts.path ?? '/';
  const qs = target == null ? '' : `?url=${encodeURIComponent(target)}`;
  const headers: Record<string, string> = {};
  const origin = opts.origin === undefined ? ORIGIN : opts.origin;
  if (origin) headers.origin = origin;
  return new Request(`https://proxy.example${path}${qs}`, {
    method: opts.method ?? 'GET',
    headers,
  });
}

/** A fetch stub that records calls and returns a scripted Response. */
function stubFetch(resp: Response | (() => Promise<Response>)) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return typeof resp === 'function' ? await resp() : resp;
  }) as unknown as typeof fetch;
  return { calls, impl };
}

describe('handleProxy', () => {
  it('proxies a 200 and wraps the upstream status in x-a14y-status', async () => {
    const f = stubFetch(
      new Response('User-agent: *', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );
    const res = await handleProxy(req('https://example.com/robots.txt'), { fetchImpl: f.impl });

    expect(res.status).toBe(200);
    expect(res.headers.get('x-a14y-status')).toBe('200');
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(res.headers.get('access-control-expose-headers')).toContain('x-a14y-status');
    expect(await res.text()).toBe('User-agent: *');
    // upstream fetched with the a14y UA and manual redirect
    expect(f.calls[0].url).toBe('https://example.com/robots.txt');
    expect((f.calls[0].init.headers as Record<string, string>)['user-agent']).toMatch(/a14y/);
    expect(f.calls[0].init.redirect).toBe('manual');
  });

  it('passes an upstream 404 through as a 200 envelope with x-a14y-status 404', async () => {
    const f = stubFetch(new Response('nope', { status: 404 }));
    const res = await handleProxy(req('https://example.com/llms.txt'), { fetchImpl: f.impl });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-a14y-status')).toBe('404');
  });

  it('passes an upstream redirect through with location so core can follow it', async () => {
    const f = stubFetch(
      new Response(null, { status: 301, headers: { location: 'https://example.com/new' } }),
    );
    const res = await handleProxy(req('https://example.com/old'), { fetchImpl: f.impl });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-a14y-status')).toBe('301');
    expect(res.headers.get('location')).toBe('https://example.com/new');
  });

  it('answers OPTIONS preflight with CORS headers and no envelope', async () => {
    const res = await handleProxy(req(null, { method: 'OPTIONS' }), { fetchImpl: stubFetch(new Response()).impl });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(res.headers.get('x-a14y-status')).toBeNull();
  });

  it('serves /health and /healthz without a proxy fetch', async () => {
    for (const path of ['/health', '/healthz']) {
      const f = stubFetch(new Response('should not be called'));
      const res = await handleProxy(req(null, { path }), { fetchImpl: f.impl });
      expect(res.status).toBe(200);
      expect(f.calls.length).toBe(0);
    }
  });

  it('rejects disallowed methods (no envelope -> proxy-level error)', async () => {
    const res = await handleProxy(req('https://example.com/', { method: 'POST' }), {
      fetchImpl: stubFetch(new Response()).impl,
    });
    expect(res.status).toBe(405);
    expect(res.headers.get('x-a14y-status')).toBeNull();
  });

  it('rejects an invalid/blocked target with 400 and no envelope', async () => {
    const f = stubFetch(new Response('x'));
    const res = await handleProxy(req('http://169.254.169.254/'), { fetchImpl: f.impl });
    expect(res.status).toBe(400);
    expect(res.headers.get('x-a14y-status')).toBeNull();
    expect(f.calls.length).toBe(0); // never fetched the blocked target
  });

  it('returns 502 (no envelope) when the upstream fetch throws', async () => {
    const f = stubFetch(async () => {
      throw new Error('network down');
    });
    const res = await handleProxy(req('https://example.com/'), { fetchImpl: f.impl });
    expect(res.status).toBe(502);
    expect(res.headers.get('x-a14y-status')).toBeNull();
  });

  it('caps oversized bodies with 413', async () => {
    const big = 'a'.repeat(20);
    const f = stubFetch(new Response(big, { status: 200 }));
    const res = await handleProxy(req('https://example.com/'), { fetchImpl: f.impl, maxBodyBytes: 10 });
    expect(res.status).toBe(413);
    expect(res.headers.get('x-a14y-status')).toBeNull();
  });

  it('enforces the rate limiter (429, no envelope)', async () => {
    const f = stubFetch(new Response('ok'));
    const limiter = { take: () => false };
    const res = await handleProxy(req('https://example.com/'), { fetchImpl: f.impl, rateLimiter: limiter });
    expect(res.status).toBe(429);
    expect(f.calls.length).toBe(0);
  });

  it('does not set allow-origin for a disallowed origin', async () => {
    const f = stubFetch(new Response('ok', { status: 200 }));
    const res = await handleProxy(req('https://example.com/', { origin: 'https://evil.example' }), {
      fetchImpl: f.impl,
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
