import { describe, expect, it } from 'vitest';
import type { CheckResult, PageReport, SiteRun } from '@a14y/core';
import { runToMarkdown } from '../src/lib/markdown';

/**
 * Small helper to build a SiteRun fixture for testing without pulling
 * in the full @a14y/core runner.
 */
function makeSiteRun(overrides: Partial<SiteRun> = {}): SiteRun {
  return {
    url: 'https://example.com/',
    baseUrl: 'https://example.com/',
    mode: 'page',
    scorecardVersion: '0.2.0',
    scorecardReleasedAt: '2026-04-06',
    startedAt: '2026-04-07T10:00:00.000Z',
    finishedAt: '2026-04-07T10:00:15.000Z',
    siteChecks: [],
    pages: [],
    summary: {
      passed: 0,
      failed: 0,
      warned: 0,
      errored: 0,
      na: 0,
      total: 0,
      applicable: 0,
      score: 0,
    },
    ...overrides,
  };
}

function check(
  id: string,
  status: CheckResult['status'],
  group: string,
  message?: string,
  scope: 'site' | 'page' = 'site',
  scorecardVersion = '0.2.0',
): CheckResult {
  return {
    id,
    name: id,
    scope,
    group,
    implementationVersion: '1.0.0',
    status,
    message,
    docsUrl: `https://timothyjordan.github.io/a14y/scorecards/${scorecardVersion}/checks/${id}/`,
  };
}

function page(
  url: string,
  checks: CheckResult[],
  score: number,
): PageReport {
  const passed = checks.filter((c) => c.status === 'pass').length;
  const applicable = checks.filter((c) => c.status !== 'na').length;
  return {
    url,
    finalUrl: url,
    status: 200,
    sources: ['crawl'],
    checks,
    summary: {
      passed,
      failed: checks.filter((c) => c.status === 'fail').length,
      warned: checks.filter((c) => c.status === 'warn').length,
      errored: checks.filter((c) => c.status === 'error').length,
      na: checks.filter((c) => c.status === 'na').length,
      total: checks.length,
      applicable,
      score,
    },
  };
}

describe('runToMarkdown', () => {
  it('renders the top-level metadata block', () => {
    const md = runToMarkdown(
      makeSiteRun({
        url: 'https://example.com/docs',
        summary: {
          passed: 10,
          failed: 2,
          warned: 1,
          errored: 0,
          na: 3,
          total: 16,
          applicable: 13,
          score: 77,
        },
      }),
    );
    expect(md).toContain('# Agent Readability Report');
    expect(md).toContain('- **URL:** https://example.com/docs');
    expect(md).toContain('- **Score:** 77/100');
    expect(md).toContain('- **Scorecard:** v0.2.0 (released 2026-04-06)');
    expect(md).toContain('- **Mode:** page');
  });

  it('includes the summary table', () => {
    const md = runToMarkdown(
      makeSiteRun({
        summary: {
          passed: 5,
          failed: 2,
          warned: 1,
          errored: 0,
          na: 3,
          total: 11,
          applicable: 8,
          score: 63,
        },
      }),
    );
    expect(md).toContain('| Passed | Failed | Warned | Errored | N/A | Applicable | Total |');
    expect(md).toContain('| 5 | 2 | 1 | 0 | 3 | 8 | 11 |');
  });

  it('groups site checks by their declared group label', () => {
    const md = runToMarkdown(
      makeSiteRun({
        siteChecks: [
          check('llms-txt.exists', 'pass', 'Discoverability', 'https://example.com/llms.txt'),
          check('llms-txt.non-empty', 'pass', 'Discoverability'),
          check('robots-txt.exists', 'fail', 'Discoverability', '/robots.txt not reachable'),
        ],
      }),
    );
    expect(md).toContain('## Site checks');
    expect(md).toContain('**Discoverability**');
    expect(md).toContain(
      '- ✅ [`llms-txt.exists`](https://timothyjordan.github.io/a14y/scorecards/0.2.0/checks/llms-txt.exists/) (pass) — https://example.com/llms.txt',
    );
    expect(md).toContain(
      '- ❌ [`robots-txt.exists`](https://timothyjordan.github.io/a14y/scorecards/0.2.0/checks/robots-txt.exists/) (fail) — /robots.txt not reachable',
    );
  });

  it('renders a single-page run with a merged page-checks heading', () => {
    const md = runToMarkdown(
      makeSiteRun({
        pages: [
          page(
            'https://example.com/',
            [check('html.canonical-link', 'pass', 'HTML metadata', 'https://example.com/', 'page')],
            100,
          ),
        ],
      }),
    );
    expect(md).toContain('## Page checks — https://example.com/');
    expect(md).toContain(
      '- ✅ [`html.canonical-link`](https://timothyjordan.github.io/a14y/scorecards/0.2.0/checks/html.canonical-link/) (pass) — https://example.com/',
    );
    // No "Pages (1)" header in single-page mode.
    expect(md).not.toContain('## Pages (');
  });

  it('renders multi-page runs with per-page sub-sections', () => {
    const md = runToMarkdown(
      makeSiteRun({
        pages: [
          page('https://example.com/a', [check('x', 'pass', 'g', undefined, 'page')], 100),
          page('https://example.com/b', [check('x', 'fail', 'g', undefined, 'page')], 0),
        ],
      }),
    );
    expect(md).toContain('## Pages (2)');
    expect(md).toContain('### 100/100 — https://example.com/a');
    expect(md).toContain('### 0/100 — https://example.com/b');
  });

  it('escapes backticks in check messages so they do not break inline code formatting', () => {
    const md = runToMarkdown(
      makeSiteRun({
        siteChecks: [
          check('x', 'fail', 'g', 'missing `script` tag'),
        ],
      }),
    );
    // The backticks in the message must be escaped so the rendered
    // markdown doesn't accidentally terminate the `x` code span.
    expect(md).toContain('missing \\`script\\` tag');
  });

  it('renders every status with its icon', () => {
    const md = runToMarkdown(
      makeSiteRun({
        siteChecks: [
          check('p', 'pass', 'g'),
          check('f', 'fail', 'g'),
          check('w', 'warn', 'g'),
          check('e', 'error', 'g'),
          check('n', 'na', 'g'),
        ],
      }),
    );
    expect(md).toContain('✅ [`p`](');
    expect(md).toContain('❌ [`f`](');
    expect(md).toContain('⚠️ [`w`](');
    expect(md).toContain('🛑 [`e`](');
    expect(md).toContain('➖ [`n`](');
  });

  it('embeds the scorecard version in every check link', () => {
    // Regression for TJ-129. The link should always point at the docs
    // page for the scorecard version that produced the result, so a
    // historical run against an older scorecard keeps linking to the
    // matching historical docs.
    const md = runToMarkdown(
      makeSiteRun({
        siteChecks: [check('llms-txt.exists', 'pass', 'Discoverability')],
        pages: [
          page(
            'https://example.com/',
            [check('html.canonical-link', 'pass', 'HTML metadata', undefined, 'page')],
            100,
          ),
        ],
      }),
    );
    expect(md).toContain(
      '[`llms-txt.exists`](https://timothyjordan.github.io/a14y/scorecards/0.2.0/checks/llms-txt.exists/)',
    );
    expect(md).toContain(
      '[`html.canonical-link`](https://timothyjordan.github.io/a14y/scorecards/0.2.0/checks/html.canonical-link/)',
    );
  });
});
