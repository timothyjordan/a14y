import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '../src/fetch/httpClient';

/**
 * Build a fake fetch that returns a canned `Response` for each URL the
 * client visits, in the order it visits them. Lets us test redirect chains
 * deterministically without spinning up a real server.
 */
function makeFakeFetch(plan: Array<{ url: string; response: Response }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let idx = 0;
  const fake = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const next = plan[idx++];
    if (!next) throw new Error(`Fake fetch ran out of responses (called ${url})`);
    if (next.url !== url) {
      throw new Error(
        `Fake fetch expected request #${idx} to be ${next.url}, got ${url}`,
      );
    }
    return next.response;
  });
  return { fake, calls };
}

function htmlResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
}

function redirect(to: string, status = 301) {
  return new Response(null, { status, headers: { location: to } });
}

describe('createHttpClient', () => {
  it('returns body and headers for a simple 200 GET', async () => {
    const { fake } = makeFakeFetch([
      { url: 'https://example.com/', response: htmlResponse('<h1>hi</h1>') },
    ]);
    const client = createHttpClient({ fetchImpl: fake });
    const page = await client.fetchPage('https://example.com/');

    expect(page.status).toBe(200);
    expect(page.body).toBe('<h1>hi</h1>');
    expect(page.redirectChain).toEqual([]);
    expect(page.url).toBe('https://example.com/');
    expect(page.$('h1').text()).toBe('hi');
  });

  it('records the redirect chain when the server sends 301s', async () => {
    const { fake } = makeFakeFetch([
      { url: 'https://example.com/old', response: redirect('https://example.com/new') },
      { url: 'https://example.com/new', response: htmlResponse('<p>final</p>') },
    ]);
    const client = createHttpClient({ fetchImpl: fake });
    const page = await client.fetchPage('https://example.com/old');

    expect(page.url).toBe('https://example.com/new');
    expect(page.redirectChain).toEqual(['https://example.com/old']);
    expect(page.body).toBe('<p>final</p>');
  });

  it('resolves relative Location headers against the current URL', async () => {
    const { fake } = makeFakeFetch([
      { url: 'https://example.com/a', response: redirect('/b') },
      { url: 'https://example.com/b', response: htmlResponse('ok') },
    ]);
    const client = createHttpClient({ fetchImpl: fake });
    const page = await client.fetchPage('https://example.com/a');
    expect(page.url).toBe('https://example.com/b');
    expect(page.redirectChain).toEqual(['https://example.com/a']);
  });

  it('throws when the redirect chain exceeds the configured maximum', async () => {
    const { fake } = makeFakeFetch([
      { url: 'https://example.com/1', response: redirect('/2') },
      { url: 'https://example.com/2', response: redirect('/3') },
      { url: 'https://example.com/3', response: redirect('/4') },
    ]);
    const client = createHttpClient({ fetchImpl: fake, defaultMaxRedirects: 2 });
    await expect(client.fetchPage('https://example.com/1')).rejects.toThrow(/Too many redirects/);
  });

  it('issues a HEAD request and returns an empty body', async () => {
    const { fake, calls } = makeFakeFetch([
      { url: 'https://example.com/file.md', response: new Response(null, { status: 200 }) },
    ]);
    const client = createHttpClient({ fetchImpl: fake });
    const resp = await client.fetch('https://example.com/file.md', { method: 'HEAD' });

    expect(resp.status).toBe(200);
    expect(resp.body).toBe('');
    expect(calls[0].init?.method).toBe('HEAD');
  });

  it('throws clearly when no fetch implementation is available', () => {
    const original = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      expect(() => createHttpClient()).toThrow(/no fetch implementation/);
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
  });
});
