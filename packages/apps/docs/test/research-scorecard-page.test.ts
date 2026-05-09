import { describe, expect, it } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import CheckResultCard from '../src/components/research/CheckResultCard.astro';
import PageDetails from '../src/components/research/PageDetails.astro';
import type { CheckResult, PageReport } from '@a14y/core';

const FIXTURE_CHECK: CheckResult = {
  id: 'llms-txt.exists',
  name: 'llms.txt is present',
  scope: 'site',
  implementationVersion: '0.2.0',
  status: 'pass',
  message: 'Found at /llms.txt',
  docsUrl: 'https://a14y.dev/scorecards/0.2.0/checks/llms-txt.exists/',
};

const FIXTURE_PAGE: PageReport = {
  url: 'https://example.com/learn',
  finalUrl: 'https://example.com/learn',
  status: 200,
  sources: [],
  checks: [
    { ...FIXTURE_CHECK, id: 'http.status-200', name: 'HTTP 200', scope: 'page' },
    {
      id: 'html.canonical',
      name: 'Canonical link present',
      scope: 'page',
      implementationVersion: '0.2.0',
      status: 'fail',
      message: 'No <link rel="canonical"> found',
      docsUrl: 'https://a14y.dev/scorecards/0.2.0/checks/html.canonical/',
    },
  ],
  summary: {
    passed: 1,
    failed: 1,
    warned: 0,
    errored: 0,
    na: 0,
    total: 2,
    applicable: 2,
    score: 50,
  },
};

describe('CheckResultCard', () => {
  it('renders status, id, message, and the docs link', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(CheckResultCard, {
      props: { check: FIXTURE_CHECK, scorecardVersion: '0.2.0' },
    });
    expect(html).toContain('class="check-card status-pass"');
    expect(html).toContain('PASS');
    expect(html).toContain('llms-txt.exists');
    expect(html).toContain('Found at /llms.txt');
    expect(html).toContain(`href="${FIXTURE_CHECK.docsUrl}"`);
  });

  it('falls back to the local docs URL when the check has none baked in', async () => {
    const container = await AstroContainer.create();
    const noUrl: CheckResult = { ...FIXTURE_CHECK, docsUrl: '' };
    const html = await container.renderToString(CheckResultCard, {
      props: { check: noUrl, scorecardVersion: '0.2.0' },
    });
    expect(html).toContain('href="/scorecards/0.2.0/checks/llms-txt.exists/"');
  });

  it('uses the fail status class for fail checks', async () => {
    const container = await AstroContainer.create();
    const failing: CheckResult = { ...FIXTURE_CHECK, status: 'fail' };
    const html = await container.renderToString(CheckResultCard, {
      props: { check: failing, scorecardVersion: '0.2.0' },
    });
    expect(html).toContain('status-fail');
    expect(html).toContain('FAIL');
  });
});

describe('PageDetails', () => {
  it('renders a collapsible block with score, url, counts, and per-check rows', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PageDetails, {
      props: { page: FIXTURE_PAGE, scorecardVersion: '0.2.0' },
    });
    expect(html).toContain('<details');
    expect(html).toContain('class="page-details"');
    // Score chip = 50 → fail bucket.
    expect(html).toMatch(/class="page-score score-fail"[^>]*>50</);
    expect(html).toContain('https://example.com/learn');
    expect(html).toContain('1/2');
    expect(html).toContain('http.status-200');
    expect(html).toContain('html.canonical');
    // Astro escapes < and " in text content, so the rendered HTML carries
    // entity refs. Check for the unique tail of the message.
    expect(html).toContain('&gt; found');
  });

  it('shows an empty-state message when no checks remain', async () => {
    const container = await AstroContainer.create();
    const empty: PageReport = { ...FIXTURE_PAGE, checks: [] };
    const html = await container.renderToString(PageDetails, {
      props: { page: empty, scorecardVersion: '0.2.0' },
    });
    expect(html).toContain('No applicable checks for this page.');
  });
});
