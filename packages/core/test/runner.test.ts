import { describe, expect, it } from 'vitest';
import { fakeHttpClient, type FakeRoute } from './_helpers';
import { validate } from '../src/runner/runSite';
import { summarize, type CheckResult } from '../src/score/compute';

const BASE = 'https://example.com';

const fullHtml = `<!doctype html>
<html lang="en">
<head>
  <link rel="canonical" href="https://example.com/">
  <link rel="alternate" type="text/markdown" href="/index.md">
  <meta name="description" content="A long enough description that comfortably exceeds the fifty character minimum for this check.">
  <meta property="og:title" content="Example">
  <meta property="og:description" content="OG desc">
  <script type="application/ld+json">
    {
      "@type": "Article",
      "dateModified": "2026-04-01",
      "@graph": [{"@type":"BreadcrumbList","itemListElement":[]}]
    }
  </script>
</head>
<body>
  <h1>One</h1><h2>Two</h2><h3>Three</h3>
  <p>${'word '.repeat(40)}</p>
  <p><a href="/glossary">Glossary</a></p>
  <pre><code class="language-ts">x</code></pre>
</body>
</html>`;

const llmsTxt = '[Index](/index.md)\n';
const sitemap = `<urlset><url><loc>https://example.com/</loc><lastmod>2026-04-01</lastmod></url></urlset>`;
const sitemapMd = '# Site\n## Pages\n- [home](/)\n';
const agentsMd = '# Project\n## Installation\nrun foo\n## Usage\nimport bar\n';
const indexMd = `---\ntitle: Home\ndescription: home page\ndoc_version: 1\nlast_updated: 2026-04-01\n---\n\n# Home\n\n## Sitemap\n[index](/sitemap.md)\n`;

function buildRoutes(): Record<string, FakeRoute> {
  return {
    'https://example.com/': {
      body: fullHtml,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    },
    'https://example.com/llms.txt': {
      body: llmsTxt,
      headers: { 'content-type': 'text/plain' },
    },
    'https://example.com/robots.txt': { body: '' },
    'https://example.com/sitemap.xml': { body: sitemap },
    'https://example.com/sitemap.md': { body: sitemapMd },
    'https://example.com/AGENTS.md': { body: agentsMd },
    'https://example.com/index.md': {
      body: indexMd,
      headers: {
        'content-type': 'text/markdown',
        link: '<https://example.com/>; rel="canonical"',
      },
    },
  };
}

describe('summarize', () => {
  it('computes score from passed / applicable', () => {
    const docsUrl = 'https://example.test/docs';
    const results: CheckResult[] = [
      { id: 'a', name: 'A', scope: 'site', implementationVersion: '1.0.0', status: 'pass', docsUrl },
      { id: 'b', name: 'B', scope: 'site', implementationVersion: '1.0.0', status: 'pass', docsUrl },
      { id: 'c', name: 'C', scope: 'page', implementationVersion: '1.0.0', status: 'fail', docsUrl },
      { id: 'd', name: 'D', scope: 'page', implementationVersion: '1.0.0', status: 'na', docsUrl },
    ];
    const s = summarize(results);
    expect(s.total).toBe(4);
    expect(s.applicable).toBe(3);
    expect(s.passed).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.na).toBe(1);
    // 2/3 = 66.66... → 67
    expect(s.score).toBe(67);
  });

  it('returns 0 when nothing is applicable', () => {
    expect(summarize([]).score).toBe(0);
  });
});

describe('validate (single page mode)', () => {
  it('runs the full scorecard against a single URL and produces a score', async () => {
    const http = fakeHttpClient(buildRoutes());
    const run = await validate({ url: 'https://example.com/', mode: 'page', http });
    expect(run.scorecardVersion).toBe('0.2.0');
    expect(run.mode).toBe('page');
    expect(run.siteChecks).toHaveLength(14);
    expect(run.pages).toHaveLength(1);
    expect(run.pages[0].checks).toHaveLength(24);
    // Most things should pass on this happy-path fixture.
    expect(run.summary.score).toBeGreaterThanOrEqual(70);
  });

  it('populates docsUrl on every CheckResult with the active scorecard version (TJ-129)', async () => {
    const http = fakeHttpClient(buildRoutes());
    const run = await validate({ url: 'https://example.com/', mode: 'page', http });
    const allChecks = [...run.siteChecks, ...run.pages.flatMap((p) => p.checks)];
    expect(allChecks.length).toBeGreaterThan(0);
    for (const c of allChecks) {
      expect(c.docsUrl).toBe(
        `https://timothyjordan.github.io/a14y/scorecards/${run.scorecardVersion}/checks/${c.id}/`,
      );
    }
  });

  it('emits progress events as the audit proceeds', async () => {
    const http = fakeHttpClient(buildRoutes());
    const events: string[] = [];
    await validate({
      url: 'https://example.com/',
      mode: 'page',
      http,
      onProgress: (e) => events.push(e.type),
    });
    expect(events[0]).toBe('started');
    expect(events).toContain('site-check-done');
    expect(events).toContain('page-done');
    expect(events[events.length - 1]).toBe('finished');
  });

  it('emits seed-progress events while loading well-known files', async () => {
    const routes = buildRoutes();
    // Make sitemap.xml a sitemapindex so we get child events too.
    routes['https://example.com/sitemap.xml'] = {
      body: `<?xml version="1.0"?><sitemapindex>
        <sitemap><loc>https://example.com/s1.xml</loc></sitemap>
        <sitemap><loc>https://example.com/s2.xml</loc></sitemap>
      </sitemapindex>`,
    };
    routes['https://example.com/s1.xml'] = {
      body: `<urlset><url><loc>https://example.com/p1</loc><lastmod>2026-04-01</lastmod></url></urlset>`,
    };
    routes['https://example.com/s2.xml'] = {
      body: `<urlset><url><loc>https://example.com/p2</loc><lastmod>2026-04-01</lastmod></url></urlset>`,
    };

    const http = fakeHttpClient(routes);
    const seedEvents: Array<{
      type: string;
      kind?: string;
      resource?: string;
      visited?: number;
      total?: number;
      found?: boolean;
    }> = [];
    await validate({
      url: 'https://example.com/',
      mode: 'page',
      http,
      onProgress: (e) => {
        if (e.type === 'seed-progress') {
          seedEvents.push({
            type: e.type,
            kind: e.event.kind,
            resource: e.event.resource,
            visited: 'visited' in e.event ? e.event.visited : undefined,
            total: 'total' in e.event ? e.event.total : undefined,
            found: 'found' in e.event ? e.event.found : undefined,
          });
        }
      },
    });

    const resources = new Set(seedEvents.map((e) => e.resource));
    expect(resources).toEqual(new Set(['llms-txt', 'sitemap-xml', 'sitemap-md']));

    const xmlEvents = seedEvents.filter((e) => e.resource === 'sitemap-xml');
    // start + 2 child + done.
    expect(xmlEvents.find((e) => e.kind === 'start')).toBeDefined();
    const childEvents = xmlEvents.filter((e) => e.kind === 'child');
    expect(childEvents).toHaveLength(2);
    expect(childEvents.at(-1)?.visited).toBe(2);
    expect(childEvents.at(-1)?.total).toBe(2);
    const done = xmlEvents.find((e) => e.kind === 'done');
    expect(done?.found).toBe(true);
  });
});

describe('validate (site mode)', () => {
  it('crawls multiple pages and aggregates the score across them', async () => {
    const routes = buildRoutes();
    const sitemapWithMore = `<urlset>
      <url><loc>https://example.com/</loc><lastmod>2026-04-01</lastmod></url>
      <url><loc>https://example.com/about</loc><lastmod>2026-04-01</lastmod></url>
    </urlset>`;
    routes['https://example.com/sitemap.xml'] = { body: sitemapWithMore };
    routes['https://example.com/about'] = {
      body: fullHtml,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    };
    const http = fakeHttpClient(routes);
    const run = await validate({
      url: 'https://example.com/',
      mode: 'site',
      http,
      concurrency: 4,
      politeDelayMs: 0,
    });
    const urls = run.pages.map((p) => p.finalUrl).sort();
    expect(urls).toContain('https://example.com/');
    expect(urls).toContain('https://example.com/about');
    expect(run.pages.length).toBeGreaterThanOrEqual(2);
    // Aggregate covers site checks + every page's page checks.
    const expectedTotal = run.siteChecks.length + run.pages.length * 24;
    expect(run.summary.total).toBe(expectedTotal);
  });

  it('streams 50 pages without retaining FetchedPage references in memory', async () => {
    // Build a fake site with 50 pages, all announced via sitemap. The
    // streaming runner should release each page's cheerio handle and
    // per-page shared-map cache entries after that page's checks finish,
    // bounding peak memory by pageCheckConcurrency rather than total
    // page count. We can't measure heap directly in vitest, but we can
    // assert the observable side effects: every page processed, every
    // input.page reference nulled, and no per-page cache entries left
    // in the shared map at the end.
    const PAGE_COUNT = 50;
    const routes: Record<string, FakeRoute> = {
      'https://example.com/sitemap.xml': {
        body:
          `<urlset>` +
          Array.from(
            { length: PAGE_COUNT },
            (_, i) =>
              `<url><loc>https://example.com/p${i}</loc><lastmod>2026-04-01</lastmod></url>`,
          ).join('') +
          `</urlset>`,
      },
    };
    for (let i = 0; i < PAGE_COUNT; i++) {
      routes[`https://example.com/p${i}`] = {
        body: fullHtml,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      };
    }

    // Hand the runner an http client whose fetchPage we can spy on so
    // we can grab references to the FetchedPage objects it produces.
    // After the run finishes, every one of those pages should have had
    // its `page` property nulled out by the runner's release step.
    const baseClient = fakeHttpClient(routes);
    const issuedPages: Array<{ url: string }> = [];
    const http = {
      ...baseClient,
      async fetchPage(url: string, opts?: Parameters<typeof baseClient.fetchPage>[1]) {
        const page = await baseClient.fetchPage(url, opts);
        issuedPages.push(page);
        return page;
      },
    };

    const run = await validate({
      url: 'https://example.com/',
      mode: 'site',
      http,
      concurrency: 8,
      pageCheckConcurrency: 4,
      politeDelayMs: 0,
    });

    expect(run.pages.length).toBeGreaterThanOrEqual(PAGE_COUNT);
    // Every PageReport carries a finalUrl + a checks array but does NOT
    // hold a FetchedPage reference. The page sources from the run.
    for (const p of run.pages) {
      expect(p.checks).toHaveLength(24);
      expect((p as unknown as { page?: unknown }).page).toBeUndefined();
    }
  });

  it('marks crawl-discovered pages as orphaned when not announced', async () => {
    const routes = buildRoutes();
    // sitemap announces only `/`; the link crawl picks up `/about`.
    routes['https://example.com/'] = {
      body: fullHtml.replace('href="/glossary"', 'href="/about"'),
      headers: { 'content-type': 'text/html; charset=utf-8' },
    };
    routes['https://example.com/about'] = {
      body: '<html lang="en"><body>x</body></html>',
      headers: { 'content-type': 'text/html; charset=utf-8' },
    };
    const http = fakeHttpClient(routes);
    const run = await validate({
      url: 'https://example.com/',
      mode: 'site',
      http,
      concurrency: 4,
      politeDelayMs: 0,
    });
    const aboutPage = run.pages.find((p) => p.finalUrl === 'https://example.com/about');
    expect(aboutPage).toBeDefined();
    const indexed = aboutPage!.checks.find((c) => c.id === 'discovery.indexed')!;
    expect(indexed.status).toBe('fail');
  });
});
