import { describe, it, expect } from 'vitest';
import { createProxyFetch } from '~/lib/scan/proxy-fetch';

const PROXY = 'https://proxy.example';

/** Build a fetch stub that records the call and returns a scripted Response. */
function stub(make: () => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return make();
  };
  return { calls, impl };
}

describe('createProxyFetch', () => {
  it('routes the target through the proxy and rebuilds the upstream status', async () => {
    const s = stub(
      () =>
        new Response('User-agent: *', {
          status: 200,
          headers: { 'x-a14y-status': '200', 'content-type': 'text/plain' },
        }),
    );
    const pf = createProxyFetch(PROXY, s.impl);
    const res = await pf('https://example.com/robots.txt');

    expect(s.calls[0].url).toBe(
      `${PROXY}/?url=${encodeURIComponent('https://example.com/robots.txt')}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(await res.text()).toBe('User-agent: *');
  });

  it('surfaces an upstream 404 as a real 404 Response (from x-a14y-status)', async () => {
    const s = stub(() => new Response('nope', { status: 200, headers: { 'x-a14y-status': '404' } }));
    const res = await createProxyFetch(PROXY, s.impl)('https://example.com/llms.txt');
    expect(res.status).toBe(404);
  });

  it('preserves a 3xx + location so core can follow the redirect itself', async () => {
    const s = stub(
      () =>
        new Response(null, {
          status: 200,
          headers: { 'x-a14y-status': '301', location: 'https://example.com/new' },
        }),
    );
    const res = await createProxyFetch(PROXY, s.impl)('https://example.com/old');
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://example.com/new');
  });

  it('does not put a body on null-body statuses (204/304)', async () => {
    const s = stub(() => new Response('', { status: 200, headers: { 'x-a14y-status': '304' } }));
    const res = await createProxyFetch(PROXY, s.impl)('https://example.com/cached');
    expect(res.status).toBe(304);
  });

  it('throws on a proxy-level error (response without x-a14y-status)', async () => {
    const s = stub(() => new Response('blocked host', { status: 400 }));
    await expect(createProxyFetch(PROXY, s.impl)('http://169.254.169.254/')).rejects.toThrow(
      /proxy error 400/i,
    );
  });

  it('forwards method and abort signal to the proxy call', async () => {
    const s = stub(() => new Response('', { status: 200, headers: { 'x-a14y-status': '200' } }));
    const controller = new AbortController();
    await createProxyFetch(PROXY, s.impl)('https://example.com/', {
      method: 'HEAD',
      signal: controller.signal,
    });
    expect(s.calls[0].init?.method).toBe('HEAD');
    expect(s.calls[0].init?.signal).toBe(controller.signal);
  });

  it('tolerates a trailing slash on the proxy base url', async () => {
    const s = stub(() => new Response('', { status: 200, headers: { 'x-a14y-status': '200' } }));
    await createProxyFetch(`${PROXY}/`, s.impl)('https://example.com/');
    expect(s.calls[0].url).toBe(`${PROXY}/?url=${encodeURIComponent('https://example.com/')}`);
  });
});
