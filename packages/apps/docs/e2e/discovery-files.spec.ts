import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage for the discovery surfaces (TJ-1337).
 *
 * The unit tests assert what the integration writes. These assert what a
 * crawler actually receives over HTTP, and close the loop the unit tests
 * cannot: that every URL the sitemap announces is really served. The
 * regression being guarded against shipped a sitemap listing 95 of ~425
 * live pages, with `/leaderboard/` and four of five `/research/` articles
 * missing entirely.
 *
 * These run against `astro dev`, which writes the discovery files at
 * `astro:config:setup` exactly as the production build does.
 */

const ORIGIN = 'https://a14y.dev';

async function fetchText(request: import('@playwright/test').APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.status(), `${path} should be served`).toBe(200);
  return response.text();
}

function locsFrom(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

test.describe('discovery files', () => {
  test('sitemap.xml is well-formed and announces the whole site', async ({ request }) => {
    const xml = await fetchText(request, '/sitemap.xml');

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);

    const locs = locsFrom(xml);
    // The broken sitemap this replaced had 95. Anything near that number
    // means the route derivation has silently regressed.
    expect(locs.length).toBeGreaterThan(400);

    // Every <url> carries a <lastmod>, which is what lets Search Console
    // prioritise re-crawls.
    const urlCount = (xml.match(/<url>/g) ?? []).length;
    const lastmodCount = (xml.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) ?? []).length;
    expect(urlCount).toBe(locs.length);
    expect(lastmodCount).toBe(urlCount);

    for (const loc of locs) {
      expect(loc.startsWith(`${ORIGIN}/`), `${loc} should be on the canonical origin`).toBe(true);
      expect(loc.endsWith('/'), `${loc} should be trailing-slashed`).toBe(true);
      expect(loc, `${loc} should not carry an unexpanded route param`).not.toMatch(/[[\]]/);
    }

    expect(new Set(locs).size, 'sitemap should not repeat a URL').toBe(locs.length);
  });

  test('sitemap.xml includes the sections that were missing', async ({ request }) => {
    const locs = new Set(locsFrom(await fetchText(request, '/sitemap.xml')));

    for (const path of [
      '/leaderboard/',
      '/badge/',
      '/badge/how-to-embed/',
      '/scorecards/scoring/',
      '/research/',
      '/research/scorecard-evals/',
      '/research/state-of-agent-readability/',
      '/research/web/',
      '/research/llms-txt-linking/',
      '/research/per-feature-ablation/',
    ]) {
      expect(locs.has(`${ORIGIN}${path}`), `${path} should be announced`).toBe(true);
    }

    const leaderboardPages = [...locs].filter((l) =>
      /\/leaderboard\/[^/]+\/$/.test(l.replace(ORIGIN, '')),
    );
    expect(leaderboardPages.length).toBeGreaterThan(300);
  });

  test('sitemap.xml excludes the /scorecards/draft/ duplicate-content alias', async ({
    request,
  }) => {
    const locs = locsFrom(await fetchText(request, '/sitemap.xml'));
    const aliased = locs.filter((l) => l.startsWith(`${ORIGIN}/scorecards/draft/`));
    expect(aliased, 'the draft alias renders duplicate content and must not be announced').toEqual(
      [],
    );
  });

  test('every URL the sitemap announces is actually served', async ({ request }) => {
    const locs = locsFrom(await fetchText(request, '/sitemap.xml'));

    // Announcing a URL that 404s is the failure mode that costs crawl
    // budget and trust. Sample across the whole list rather than fetching
    // 400+ pages: take every top-level section plus a spread of the
    // leaderboard pages, which are the ones generated from data and so
    // the ones most likely to drift out of sync with their routes.
    const paths = locs.map((l) => l.replace(ORIGIN, ''));
    const sections = paths.filter((p) => p.split('/').filter(Boolean).length <= 1);
    const leaderboard = paths.filter((p) => p.startsWith('/leaderboard/') && p !== '/leaderboard/');
    const sampled = [
      ...sections,
      ...leaderboard.filter((_, i) => i % 40 === 0),
      paths.find((p) => p.startsWith('/scorecards/') && p.includes('/checks/'))!,
      paths.find((p) => p.endsWith('/changes/'))!,
      paths.find((p) => p.startsWith('/scorecards/scoring/') && p !== '/scorecards/scoring/')!,
    ].filter(Boolean);

    for (const path of sampled) {
      const response = await request.get(path);
      expect(response.status(), `${path} is in the sitemap but returned ${response.status()}`).toBe(
        200,
      );
    }
  });

  test('robots.txt allows every crawler and points at the sitemap', async ({ request }) => {
    const robots = await fetchText(request, '/robots.txt');

    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    // No Disallow at all: the AI crawlers this project exists to serve
    // (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) are covered by
    // the wildcard, and a stray Disallow would silently exclude them.
    expect(robots).not.toContain('Disallow:');
  });

  test('llms.txt indexes the research articles and the leaderboard', async ({ request }) => {
    const llms = await fetchText(request, '/llms.txt');

    for (const slug of [
      'scorecard-evals',
      'state-of-agent-readability',
      'web',
      'llms-txt-linking',
      'per-feature-ablation',
    ]) {
      expect(llms, `research/${slug} should be indexed`).toContain(`(/research/${slug}.md)`);
    }

    expect(llms).toContain('(/leaderboard.md)');
    // The per-site leaderboard pages belong in the sitemaps, not in an
    // index an agent reads start to finish.
    expect(llms).not.toMatch(/\(\/leaderboard\/[^)]+\.md\)/);
    expect(llms.split('\n').length).toBeLessThan(200);

    // Every research entry carries a real title rather than a bare slug.
    for (const [, label, slug] of llms.matchAll(/- \[([^\]]+)\]\(\/research\/([^)]+)\.md\)/g)) {
      expect(label!.toLowerCase(), `research/${slug} shipped without a title`).not.toBe(slug!);
    }

    expect(llms).toContain('Full sitemap: [/sitemap.md](/sitemap.md)');
  });

  test('sitemap.md covers the same routes as sitemap.xml', async ({ request }) => {
    const [xml, md] = await Promise.all([
      fetchText(request, '/sitemap.xml'),
      fetchText(request, '/sitemap.md'),
    ]);

    const fromXml = new Set(locsFrom(xml).map((l) => l.replace(ORIGIN, '')));
    const fromMd = new Set([...md.matchAll(/- \[(\/[^\]]*)\]\(/g)].map((m) => m[1]!));

    expect(fromMd.size).toBe(fromXml.size);
    for (const path of fromXml) {
      expect(fromMd.has(path), `${path} is in sitemap.xml but not sitemap.md`).toBe(true);
    }

    expect(md).toContain('## Leaderboard');
    expect(md).toContain('## Research');
  });
});
