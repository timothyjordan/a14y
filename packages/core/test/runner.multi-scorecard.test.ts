import { afterEach, describe, expect, it } from 'vitest';
import { fakeHttpClient, type FakeRoute } from './_helpers';
import { validateMulti } from '../src/runner/runSite';
import { SCORECARDS } from '../src/scorecard';
import { SCORECARD_0_2_0 } from '../src/scorecard/v0_2';
import { SCORECARD_DRAFT } from '../src/scorecard/draft';
import { registerCheck } from '../src/scorecard/registry';
import type {
  PageCheckSpec,
  ScorecardManifest,
} from '../src/scorecard/types';

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
    'https://example.com/AGENTS': { body: '', status: 404 },
    'https://example.com/index.md': {
      body: indexMd,
      headers: {
        'content-type': 'text/markdown',
        link: '<https://example.com/>; rel="canonical"',
      },
    },
  };
}

describe('validateMulti — pin parity', () => {
  it('returns one SiteRun per scorecard with their respective methodologies', async () => {
    const http = fakeHttpClient(buildRoutes());
    const runs = await validateMulti({
      url: BASE,
      mode: 'page',
      scorecardVersions: [SCORECARD_0_2_0.version, SCORECARD_DRAFT.version],
      http,
    });
    expect(runs).toHaveLength(2);
    expect(runs[0].scorecardVersion).toBe(SCORECARD_0_2_0.version);
    expect(runs[0].scoringMethodology).toBe('flat-pool-v1');
    expect(runs[1].scorecardVersion).toBe(SCORECARD_DRAFT.version);
    expect(runs[1].scoringMethodology).toBe('per-check-mean-v1');
  });

  it('shares page fetches across scorecards (page bodies identical)', async () => {
    // The crawl machinery is one shared layer, so the same fetched page
    // produces one PageReport per scorecard. The `finalUrl` and `status`
    // are the resource itself — they must be byte-equal across the runs.
    const http = fakeHttpClient(buildRoutes());
    const runs = await validateMulti({
      url: BASE,
      mode: 'page',
      scorecardVersions: [SCORECARD_0_2_0.version, SCORECARD_DRAFT.version],
      http,
    });
    expect(runs[0].pages).toHaveLength(1);
    expect(runs[1].pages).toHaveLength(1);
    expect(runs[0].pages[0].finalUrl).toBe(runs[1].pages[0].finalUrl);
    expect(runs[0].pages[0].status).toBe(runs[1].pages[0].status);
  });

  it('shared check IDs with pin parity produce identical outcomes across scorecards', async () => {
    // v0.2.0 and the draft both pin every shared check ID to the same
    // impl version, so for every check ID that appears in both manifests
    // the (status, message) tuple must match byte-for-byte. Only the
    // `docsUrl` differs (scorecard-specific link).
    const http = fakeHttpClient(buildRoutes());
    const runs = await validateMulti({
      url: BASE,
      mode: 'page',
      scorecardVersions: [SCORECARD_0_2_0.version, SCORECARD_DRAFT.version],
      http,
    });
    const v02 = new Map(runs[0].siteChecks.map((c) => [c.id, c] as const));
    const draft = new Map(runs[1].siteChecks.map((c) => [c.id, c] as const));
    for (const [id, sc02] of v02) {
      const scDraft = draft.get(id);
      if (!scDraft) continue;
      expect(scDraft.status).toBe(sc02.status);
      expect(scDraft.message).toBe(sc02.message);
      expect(scDraft.implementationVersion).toBe(sc02.implementationVersion);
      // docsUrl is scorecard-specific by design.
      expect(scDraft.docsUrl).not.toBe(sc02.docsUrl);
    }
  });

  it('dedupes duplicate scorecard versions', async () => {
    const http = fakeHttpClient(buildRoutes());
    const runs = await validateMulti({
      url: BASE,
      mode: 'page',
      scorecardVersions: [SCORECARD_0_2_0.version, SCORECARD_0_2_0.version],
      http,
    });
    expect(runs).toHaveLength(1);
    expect(runs[0].scorecardVersion).toBe(SCORECARD_0_2_0.version);
  });

  it('throws when no scorecard versions are provided', async () => {
    const http = fakeHttpClient(buildRoutes());
    await expect(
      validateMulti({
        url: BASE,
        mode: 'page',
        scorecardVersions: [],
        http,
      }),
    ).rejects.toThrow(/at least one scorecard/i);
  });
});

describe('validateMulti — divergent impl versions', () => {
  // Register a test-only page check with TWO impl versions so we can
  // construct scorecards that pin it differently and prove that each
  // scorecard's SiteRun receives the result of its own pinned impl.
  // Counters live at module scope so each impl can record how many
  // times it was invoked across the test's single fetch.
  let counters: { v100: number; v110: number };

  const TEST_CHECK_ID = 'test.multi-scorecard.fixture';

  const fixtureCheck: PageCheckSpec = {
    id: TEST_CHECK_ID,
    scope: 'page',
    name: 'Multi-scorecard fixture check',
    implementations: {
      '1.0.0': {
        version: '1.0.0',
        description: 'Always passes; counts invocations.',
        run: async () => {
          counters.v100++;
          return { status: 'pass', message: 'v1.0.0 fired' };
        },
      },
      '1.1.0': {
        version: '1.1.0',
        description: 'Always fails; counts invocations.',
        run: async () => {
          counters.v110++;
          return { status: 'fail', message: 'v1.1.0 fired' };
        },
      },
    },
  };

  registerCheck(fixtureCheck);

  // Two test scorecards that pin the fixture check at different impl
  // versions but otherwise share v0.2.0's pin set. Injected directly
  // into SCORECARDS the same way scorecard.test.ts does for legacy /
  // bad-methodology coverage.
  const SCORECARD_PINS_100: ScorecardManifest = {
    version: '9.9.0-test-pins-1.0.0',
    releasedAt: 'never',
    description: 'test fixture',
    checks: { ...SCORECARD_0_2_0.checks, [TEST_CHECK_ID]: '1.0.0' },
    scoringMethodology: 'flat-pool-v1',
  };
  const SCORECARD_PINS_110: ScorecardManifest = {
    version: '9.9.0-test-pins-1.1.0',
    releasedAt: 'never',
    description: 'test fixture',
    checks: { ...SCORECARD_0_2_0.checks, [TEST_CHECK_ID]: '1.1.0' },
    scoringMethodology: 'flat-pool-v1',
  };

  afterEach(() => {
    delete SCORECARDS[SCORECARD_PINS_100.version];
    delete SCORECARDS[SCORECARD_PINS_110.version];
  });

  it('runs each divergent impl exactly once per page (not per scorecard)', async () => {
    counters = { v100: 0, v110: 0 };
    SCORECARDS[SCORECARD_PINS_100.version] = SCORECARD_PINS_100;
    SCORECARDS[SCORECARD_PINS_110.version] = SCORECARD_PINS_110;

    const http = fakeHttpClient(buildRoutes());
    const runs = await validateMulti({
      url: BASE,
      mode: 'page',
      scorecardVersions: [SCORECARD_PINS_100.version, SCORECARD_PINS_110.version],
      http,
    });

    expect(runs).toHaveLength(2);
    // Single page audit, one fetch, each impl fires once on that page.
    // The crucial assertion: NOT 2× per impl — page fetched + checks run
    // exactly once per (id, impl) pair across the union.
    expect(counters.v100).toBe(1);
    expect(counters.v110).toBe(1);
  });

  it('routes each impl outcome to the scorecard that pinned it', async () => {
    counters = { v100: 0, v110: 0 };
    SCORECARDS[SCORECARD_PINS_100.version] = SCORECARD_PINS_100;
    SCORECARDS[SCORECARD_PINS_110.version] = SCORECARD_PINS_110;

    const http = fakeHttpClient(buildRoutes());
    const runs = await validateMulti({
      url: BASE,
      mode: 'page',
      scorecardVersions: [SCORECARD_PINS_100.version, SCORECARD_PINS_110.version],
      http,
    });

    const find = (runIdx: number) =>
      runs[runIdx].pages[0].checks.find((c) => c.id === TEST_CHECK_ID);
    const inV100 = find(0);
    const inV110 = find(1);
    expect(inV100?.implementationVersion).toBe('1.0.0');
    expect(inV100?.status).toBe('pass');
    expect(inV100?.message).toBe('v1.0.0 fired');
    expect(inV110?.implementationVersion).toBe('1.1.0');
    expect(inV110?.status).toBe('fail');
    expect(inV110?.message).toBe('v1.1.0 fired');
  });
});
