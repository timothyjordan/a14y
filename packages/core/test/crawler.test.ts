import { describe, expect, it } from 'vitest';
import { fakeHttpClient, type FakeRoute } from './_helpers';
import { crawlSiteToArray } from '../src/crawler';
import { collectSeeds } from '../src/crawler/sources';
import { extractSameOriginLinks } from '../src/crawler/linkExtract';
import { ConcurrentQueue } from '../src/crawler/queue';
import type { SiteCheckContext } from '../src/scorecard/types';

const BASE = 'https://example.com';

function siteCtx(routes: Record<string, FakeRoute>): SiteCheckContext {
  return {
    scope: 'site',
    baseUrl: BASE,
    http: fakeHttpClient(routes),
    shared: new Map(),
  };
}

describe('crawler/sources', () => {
  it('merges urls from sitemap.xml, llms.txt, and sitemap.md', async () => {
    const ctx = siteCtx({
      'https://example.com/sitemap.xml': {
        body: `<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>`,
      },
      'https://example.com/llms.txt': {
        body: `[A](https://example.com/a)\n[C](https://example.com/c)\n`,
        headers: { 'content-type': 'text/plain' },
      },
      'https://example.com/sitemap.md': {
        body: `# Index\n- [d](/d.md)\n`,
      },
    });
    const seeds = await collectSeeds(ctx);
    expect([...seeds.urls].sort()).toEqual([
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
      'https://example.com/d.md',
    ]);
    expect(seeds.bySource.get('https://example.com/a')).toEqual(
      new Set(['sitemap-xml', 'llms-txt']),
    );
  });

  it('returns an empty seed set when nothing is published', async () => {
    const ctx = siteCtx({});
    const seeds = await collectSeeds(ctx);
    expect(seeds.urls.size).toBe(0);
  });
});

describe('crawler/linkExtract', () => {
  it('keeps only same-origin http(s) links and strips fragments', async () => {
    const ctx = siteCtx({});
    const html = `<html><body>
      <a href="/page-a">a</a>
      <a href="https://example.com/page-b#section">b</a>
      <a href="https://other.com/x">other</a>
      <a href="mailto:foo@example.com">mail</a>
      <a href="javascript:void(0)">js</a>
    </body></html>`;
    const page = await ctx.http.fetchPage('https://example.com/');
    // Override body via fakeHttpClient routes
    const ctx2 = siteCtx({ 'https://example.com/': { body: html } });
    const fetched = await ctx2.http.fetchPage('https://example.com/');
    const links = extractSameOriginLinks(fetched, BASE);
    expect(links.sort()).toEqual([
      'https://example.com/page-a',
      'https://example.com/page-b',
    ]);
    // Avoid lint about unused
    expect(page).toBeTruthy();
  });
});

describe('crawler/linkExtract example detection', () => {
  it('skips <a> nested in <pre>, <code>, <samp>, or <kbd>', async () => {
    const html = `<html><body>
      <a href="/real">real</a>
      <pre><a href="/example-in-pre">x</a></pre>
      <code><a href="/example-in-code">y</a></code>
      <samp><a href="/example-in-samp">z</a></samp>
      <kbd><a href="/example-in-kbd">w</a></kbd>
      <pre><code><a href="/example-deeply-nested">d</a></code></pre>
    </body></html>`;
    const ctx = siteCtx({ 'https://example.com/': { body: html } });
    const fetched = await ctx.http.fetchPage('https://example.com/');
    const links = extractSameOriginLinks(fetched, BASE);
    expect(links.sort()).toEqual(['https://example.com/real']);
  });

  it('strips markdown fenced code blocks before extracting links', async () => {
    // Markdown body that mixes raw HTML (which mirror generators emit) with
    // fenced HTML examples. Only the unfenced <a> should be extracted.
    const body = `---
title: example
---

Some prose. <a href="/real-md">real</a>

\`\`\`html
<footer>
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
</footer>
\`\`\`

More prose.
`;
    const ctx = siteCtx({
      'https://example.com/page.md': {
        body,
        headers: { 'content-type': 'text/markdown; charset=utf-8' },
      },
    });
    const fetched = await ctx.http.fetchPage('https://example.com/page.md');
    const links = extractSameOriginLinks(fetched, BASE);
    expect(links.sort()).toEqual(['https://example.com/real-md']);
  });

  it('detects markdown by .md/.mdx URL extension when content-type is missing', async () => {
    const body = `\`\`\`html
<a href="/about">About</a>
\`\`\`
`;
    const ctx = siteCtx({
      'https://example.com/some.md': { body },
      'https://example.com/some.mdx': { body },
    });
    for (const url of ['https://example.com/some.md', 'https://example.com/some.mdx']) {
      const fetched = await ctx.http.fetchPage(url);
      expect(extractSameOriginLinks(fetched, BASE)).toEqual([]);
    }
  });

  it('strips tilde-fenced (~~~) blocks too', async () => {
    const body = `~~~html
<a href="/about">About</a>
~~~
`;
    const ctx = siteCtx({
      'https://example.com/page.md': {
        body,
        headers: { 'content-type': 'text/markdown' },
      },
    });
    const fetched = await ctx.http.fetchPage('https://example.com/page.md');
    expect(extractSameOriginLinks(fetched, BASE)).toEqual([]);
  });

  it('strips inline code spans in markdown', async () => {
    const body = `Try \`<a href="/inline-example">x</a>\` for the snippet syntax.

Real link: <a href="/real-inline">real</a>.
`;
    const ctx = siteCtx({
      'https://example.com/page.md': {
        body,
        headers: { 'content-type': 'text/markdown' },
      },
    });
    const fetched = await ctx.http.fetchPage('https://example.com/page.md');
    expect(extractSameOriginLinks(fetched, BASE).sort()).toEqual([
      'https://example.com/real-inline',
    ]);
  });

  it('does NOT strip fences on HTML pages (text in HTML can legitimately contain backticks)', async () => {
    // An HTML page that talks about markdown fences in plain text. Backtick
    // sequences in HTML body text shouldn't trigger fence stripping; the
    // ancestor filter still skips <a> inside <pre>/<code>.
    const html = `<html><body>
      <p>Markdown fences look like \`\`\` triple backticks \`\`\`. Here is a real anchor:</p>
      <a href="/real-html">real</a>
    </body></html>`;
    const ctx = siteCtx({
      'https://example.com/': {
        body: html,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      },
    });
    const fetched = await ctx.http.fetchPage('https://example.com/');
    expect(extractSameOriginLinks(fetched, BASE)).toEqual(['https://example.com/real-html']);
  });
});

describe('crawler/queue', () => {
  it('runs at most concurrency tasks at once', async () => {
    const queue = new ConcurrentQueue({ concurrency: 2 });
    let active = 0;
    let max = 0;
    const tasks = Array.from({ length: 6 }, () =>
      queue.add(async () => {
        active++;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      }),
    );
    await Promise.all(tasks);
    expect(max).toBeLessThanOrEqual(2);
    expect(max).toBeGreaterThan(0);
  });

  it('onIdle resolves once everything has settled', async () => {
    const queue = new ConcurrentQueue({ concurrency: 1 });
    queue.add(() => new Promise<void>((r) => setTimeout(r, 5)));
    queue.add(() => new Promise<void>((r) => setTimeout(r, 5)));
    await queue.onIdle();
    // No assertion beyond reaching here without hanging.
    expect(true).toBe(true);
  });
});

describe('crawler/crawlSite', () => {
  it('discovers pages from sitemap and follows in-site links', async () => {
    const sitemap = `<urlset><url><loc>https://example.com/start</loc></url></urlset>`;
    const start = `<html><body>
      <a href="/a">a</a>
      <a href="/b">b</a>
      <a href="https://other.com/skip">x</a>
    </body></html>`;
    const a = `<html><body><a href="/c">c</a></body></html>`;
    const b = `<html><body></body></html>`;
    const c = `<html><body></body></html>`;

    const ctx = siteCtx({
      'https://example.com/sitemap.xml': { body: sitemap },
      'https://example.com/start': { body: start },
      'https://example.com/a': { body: a },
      'https://example.com/b': { body: b },
      'https://example.com/c': { body: c },
    });

    const pages = await crawlSiteToArray({
      baseUrl: BASE,
      http: ctx.http,
      siteCtx: ctx,
      concurrency: 4,
      politeDelayMs: 0,
    });
    const urls = pages.map((p) => p.url).sort();
    // The base URL is always seeded too. It 404s in our route map but the
    // fake fetch still returns a FetchedPage; failing-status pages are
    // yielded so the http.status-200 check can flag them. We still expect
    // every sitemap-discovered URL plus the link-crawled descendants.
    expect(urls).toEqual([
      'https://example.com/',
      'https://example.com/a',
      'https://example.com/b',
      'https://example.com/c',
      'https://example.com/start',
    ]);
    const startPage = pages.find((p) => p.url === 'https://example.com/start')!;
    expect(startPage.sources.has('sitemap-xml')).toBe(true);
    const cPage = pages.find((p) => p.url === 'https://example.com/c')!;
    expect(cPage.sources.has('crawl')).toBe(true);
  });

  it('seeds from entryUrl when provided so subpath-hosted sites are reachable', async () => {
    // Subpath-hosted site at /docs/. The origin root 404s (typical for
    // shared github.io domains where the user doesn't own the top
    // level). Without entryUrl the crawler used to bounce off /, so
    // every page-level check ran against a 404 body.
    const subpathHtml = `<html lang="en"><body>
      <a href="/docs/install">install</a>
    </body></html>`;
    const installHtml = `<html lang="en"><body>installed</body></html>`;

    const ctx = siteCtx({
      'https://example.com/docs/': { body: subpathHtml },
      'https://example.com/docs/install': { body: installHtml },
      // origin root deliberately omitted -> 404 in the fake fetch
    });

    const pages = await crawlSiteToArray({
      baseUrl: BASE,
      http: ctx.http,
      siteCtx: ctx,
      entryUrl: 'https://example.com/docs/',
      concurrency: 4,
      politeDelayMs: 0,
    });
    const urls = pages.map((p) => p.url).sort();
    // The crawler should visit the subpath entry AND follow the link
    // to /docs/install. Origin root is NOT visited because we
    // explicitly told the crawler where to start.
    expect(urls).toEqual([
      'https://example.com/docs/',
      'https://example.com/docs/install',
    ]);
    const root = pages.find((p) => p.url === 'https://example.com/docs/')!;
    expect(root.sources.has('crawl')).toBe(true);
  });

  it('respects maxPages and stops crawling beyond the cap', async () => {
    const routes: Record<string, FakeRoute> = {
      'https://example.com/sitemap.xml': {
        body:
          `<urlset>` +
          Array.from({ length: 10 }, (_, i) => `<url><loc>https://example.com/p${i}</loc></url>`).join('') +
          `</urlset>`,
      },
    };
    for (let i = 0; i < 10; i++) {
      routes[`https://example.com/p${i}`] = { body: '<html></html>' };
    }
    const ctx = siteCtx(routes);
    const pages = await crawlSiteToArray({
      baseUrl: BASE,
      http: ctx.http,
      siteCtx: ctx,
      maxPages: 3,
      concurrency: 2,
      politeDelayMs: 0,
    });
    expect(pages.length).toBeLessThanOrEqual(3);
  });
});
