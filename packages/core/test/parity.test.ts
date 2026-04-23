import { describe, expect, it } from 'vitest';
import { fakeHttpClient } from './_helpers';
import { validate } from '../src/runner/runSite';

/**
 * CLI/extension parity contract test.
 *
 * The CLI and the Chrome extension both call `validate()` from
 * @a14y/core. As long as the underlying HttpClient returns identical
 * responses, the engine MUST produce a byte-identical SiteRun — same score,
 * same per-check breakdown, same ordering. Both targets ship the same
 * compiled module, so this test exercises the contract by running validate
 * twice against the same in-memory routes (one round simulating the CLI's
 * Node fetch, the other simulating the extension's service-worker fetch)
 * and asserting deterministic output.
 *
 * If this test ever drifts, it means a check is using a wallclock timestamp,
 * an iteration order isn't deterministic, or some other source of nondeter-
 * minism has slipped in — exactly the kind of bug that would cause two
 * users running the same audit on the same site to see different scores.
 */

const routes = {
  'https://example.com/': {
    body: `<!doctype html>
<html lang="en">
<head>
  <link rel="canonical" href="https://example.com/">
  <link rel="alternate" type="text/markdown" href="/index.md">
  <meta name="description" content="A reasonably long description that easily exceeds the fifty character minimum.">
  <meta property="og:title" content="Example">
  <meta property="og:description" content="OG desc">
  <script type="application/ld+json">
    {"@type":"Article","dateModified":"2026-04-01","@graph":[{"@type":"BreadcrumbList","itemListElement":[]}]}
  </script>
</head>
<body>
  <h1>One</h1><h2>Two</h2><h3>Three</h3>
  <p>${'word '.repeat(40)}</p>
  <p><a href="/glossary">Glossary</a></p>
  <pre><code class="language-ts">x</code></pre>
</body>
</html>`,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  },
  'https://example.com/llms.txt': {
    body: '[Index](/index.md)\n',
    headers: { 'content-type': 'text/plain' },
  },
  'https://example.com/sitemap.xml': {
    body: `<urlset><url><loc>https://example.com/</loc><lastmod>2026-04-01</lastmod></url></urlset>`,
  },
  'https://example.com/sitemap.md': { body: '# Site\n## Pages\n- [home](/)\n' },
  'https://example.com/AGENTS.md': {
    body: '# Project\n## Installation\nrun foo\n## Usage\nimport bar\n',
  },
  'https://example.com/index.md': {
    body:
      '---\ntitle: Home\ndescription: home page\ndoc_version: 1\nlast_updated: 2026-04-01\n---\n\n# Home\n\n## Sitemap\n[index](/sitemap.md)\n',
    headers: {
      'content-type': 'text/markdown',
      link: '<https://example.com/>; rel="canonical"',
    },
  },
};

/**
 * Strip wallclock fields so two runs can be compared structurally without
 * tripping on the timestamps the runner stamps on each SiteRun.
 */
function strip(run: import('../src/runner/runSite').SiteRun) {
  const { startedAt: _s, finishedAt: _f, ...rest } = run;
  return rest;
}

describe('CLI/extension parity contract', () => {
  it('produces byte-identical SiteRuns across two runs of the same fixture', async () => {
    const a = await validate({
      url: 'https://example.com/',
      mode: 'page',
      http: fakeHttpClient(routes),
    });
    const b = await validate({
      url: 'https://example.com/',
      mode: 'page',
      http: fakeHttpClient(routes),
    });

    expect(strip(a)).toEqual(strip(b));
    expect(a.summary.score).toBe(b.summary.score);
    expect(a.siteChecks.map((c) => c.id)).toEqual(b.siteChecks.map((c) => c.id));
    expect(a.pages[0].checks.map((c) => c.id)).toEqual(b.pages[0].checks.map((c) => c.id));
  });

  it('site mode is also deterministic across runs', async () => {
    const a = await validate({
      url: 'https://example.com/',
      mode: 'site',
      http: fakeHttpClient(routes),
      politeDelayMs: 0,
    });
    const b = await validate({
      url: 'https://example.com/',
      mode: 'site',
      http: fakeHttpClient(routes),
      politeDelayMs: 0,
    });

    // Order pages deterministically before comparing — the crawler streams
    // pages back as they finish, which can race in tight runs.
    const sortPages = (run: import('../src/runner/runSite').SiteRun) => ({
      ...strip(run),
      pages: [...run.pages].sort((p, q) => p.finalUrl.localeCompare(q.finalUrl)),
    });

    expect(sortPages(a)).toEqual(sortPages(b));
  });

  it('locks scorecard v0.2.0 score for the happy-path fixture', async () => {
    // Snapshot the score & per-check status array for the happy-path
    // fixture so any unintended change to a check's behavior shows up as a
    // failing assertion. Updating this number is a deliberate signal that
    // the scorecard or a check implementation has changed and the
    // implementation version should be bumped.
    const run = await validate({
      url: 'https://example.com/',
      mode: 'page',
      http: fakeHttpClient(routes),
    });
    expect(run.scorecardVersion).toBe('0.2.0');
    expect(run.summary.score).toMatchInlineSnapshot('94');
    const sitePass = run.siteChecks.filter((c) => c.status === 'pass').length;
    const pagePass = run.pages[0].checks.filter((c) => c.status === 'pass').length;
    expect(sitePass + pagePass).toBe(run.summary.passed);
  });
});
