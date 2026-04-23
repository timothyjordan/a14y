import { describe, expect, it } from 'vitest';
import { runToAgentPrompt } from '../src/report/agentPrompt';
import type { CheckResult } from '../src/score/compute';
import type { PageReport, SiteRun } from '../src/runner/runSite';

function check(
  id: string,
  status: CheckResult['status'],
  opts: { name?: string; group?: string; message?: string; scope?: 'site' | 'page' } = {},
): CheckResult {
  return {
    id,
    name: opts.name ?? id,
    group: opts.group ?? 'Test group',
    scope: opts.scope ?? 'page',
    implementationVersion: '1.0.0',
    status,
    message: opts.message,
    docsUrl: `https://timothyjordan.github.io/a14y/scorecards/0.2.0/checks/${id}/`,
  };
}

function page(url: string, checks: CheckResult[]): PageReport {
  return {
    url,
    finalUrl: url,
    status: 200,
    sources: ['crawl'],
    checks,
    summary: {
      passed: checks.filter((c) => c.status === 'pass').length,
      failed: checks.filter((c) => c.status === 'fail').length,
      warned: checks.filter((c) => c.status === 'warn').length,
      errored: checks.filter((c) => c.status === 'error').length,
      na: checks.filter((c) => c.status === 'na').length,
      total: checks.length,
      applicable: checks.filter((c) => c.status !== 'na').length,
      score: 0,
    },
  };
}

function run(overrides: Partial<SiteRun> = {}): SiteRun {
  return {
    url: 'https://example.com/',
    baseUrl: 'https://example.com/',
    mode: 'site',
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
      score: 100,
    },
    ...overrides,
  };
}

describe('runToAgentPrompt', () => {
  it('emits the "Nothing to fix" sentinel when there are no failures', () => {
    const md = runToAgentPrompt(
      run({
        siteChecks: [check('llms-txt.exists', 'pass', { scope: 'site' })],
        pages: [page('https://example.com/', [check('html.canonical-link', 'pass')])],
      }),
    );
    expect(md).toContain('## Nothing to fix');
    expect(md).not.toContain('### 1.');
    expect(md).not.toContain('## Failing checks');
  });

  it('renders a single failing page check with id, docs URL, message, and url bullet', () => {
    const md = runToAgentPrompt(
      run({
        pages: [
          page('https://example.com/a', [
            check('html.canonical-link', 'fail', { message: 'no canonical' }),
          ]),
        ],
      }),
    );
    expect(md).toContain('### 1. `html.canonical-link` — failed on 1 page(s)');
    expect(md).toContain('- **Sample message:** `no canonical`');
    expect(md).toContain(
      '- **Docs:** https://timothyjordan.github.io/a14y/scorecards/0.2.0/checks/html.canonical-link/',
    );
    expect(md).toContain('- **Affected pages (1):**');
    expect(md).toContain('  - https://example.com/a');
  });

  it('de-duplicates the same id failing on multiple pages into one entry', () => {
    const md = runToAgentPrompt(
      run({
        pages: [
          page('https://example.com/a', [check('markdown.canonical-header', 'fail')]),
          page('https://example.com/b', [check('markdown.canonical-header', 'fail')]),
          page('https://example.com/c', [check('markdown.canonical-header', 'fail')]),
        ],
      }),
    );
    expect(md).toContain('### 1. `markdown.canonical-header` — failed on 3 page(s)');
    // Only one section with that id.
    expect(md.match(/`markdown\.canonical-header`/g)?.length).toBe(1);
    expect(md).toContain('  - https://example.com/a');
    expect(md).toContain('  - https://example.com/b');
    expect(md).toContain('  - https://example.com/c');
  });

  it('truncates the affected URL list at maxUrlsPerCheck', () => {
    const pages = Array.from({ length: 25 }, (_, i) =>
      page(`https://example.com/p${i}`, [check('x.fail', 'fail')]),
    );
    const md = runToAgentPrompt(run({ pages }), { maxUrlsPerCheck: 5 });
    expect(md).toContain('  - https://example.com/p0');
    expect(md).toContain('  - https://example.com/p4');
    expect(md).not.toContain('  - https://example.com/p5');
    expect(md).toContain('  - … and 20 more');
  });

  it('sorts entries by impact (most-affected first), then alphabetically', () => {
    const pages = [
      page('https://example.com/a', [
        check('big.fail', 'fail'),
        check('small.fail', 'fail'),
      ]),
      page('https://example.com/b', [check('big.fail', 'fail')]),
      page('https://example.com/c', [check('big.fail', 'fail')]),
      page('https://example.com/d', [check('big.fail', 'fail')]),
      page('https://example.com/e', [check('big.fail', 'fail')]),
    ];
    const md = runToAgentPrompt(run({ pages }));
    const bigIdx = md.indexOf('`big.fail`');
    const smallIdx = md.indexOf('`small.fail`');
    expect(bigIdx).toBeGreaterThan(0);
    expect(smallIdx).toBeGreaterThan(bigIdx);
    expect(md).toContain('### 1. `big.fail` — failed on 5 page(s)');
    expect(md).toContain('### 2. `small.fail` — failed on 1 page(s)');
  });

  it('renders site-scope failures with a "failed site-wide" header and no URL list', () => {
    const md = runToAgentPrompt(
      run({
        siteChecks: [
          check('llms-txt.exists', 'fail', {
            scope: 'site',
            message: 'no llms.txt found',
          }),
        ],
      }),
    );
    expect(md).toContain('### 1. `llms-txt.exists` — failed site-wide');
    expect(md).toContain('- **Message:** `no llms.txt found`');
    expect(md).toContain('- **Scope:** entire site');
    expect(md).not.toContain('- **Affected pages');
  });

  it('picks the modal message and notes the variant count when messages differ', () => {
    const md = runToAgentPrompt(
      run({
        pages: [
          page('https://example.com/a', [check('x', 'fail', { message: 'common' })]),
          page('https://example.com/b', [check('x', 'fail', { message: 'common' })]),
          page('https://example.com/c', [check('x', 'fail', { message: 'common' })]),
          page('https://example.com/d', [check('x', 'fail', { message: 'rare' })]),
        ],
      }),
    );
    expect(md).toContain('- **Sample message:** `common` _(+ 1 other variant(s))_');
  });

  it('includes errored checks alongside failing ones', () => {
    const md = runToAgentPrompt(
      run({
        pages: [
          page('https://example.com/a', [
            check('boom', 'error', { message: 'cheerio explosion' }),
          ]),
        ],
      }),
    );
    expect(md).toContain('### 1. `boom` — failed on 1 page(s)');
    expect(md).toContain('cheerio explosion');
  });

  it('excludes pass, warn, and na statuses from the output', () => {
    const md = runToAgentPrompt(
      run({
        siteChecks: [
          check('site-pass', 'pass', { scope: 'site' }),
          check('site-warn', 'warn', { scope: 'site' }),
        ],
        pages: [
          page('https://example.com/a', [
            check('page-pass', 'pass'),
            check('page-warn', 'warn'),
            check('page-na', 'na'),
            check('page-fail', 'fail'),
          ]),
        ],
      }),
    );
    expect(md).toContain('`page-fail`');
    expect(md).not.toContain('`site-pass`');
    expect(md).not.toContain('`site-warn`');
    expect(md).not.toContain('`page-pass`');
    expect(md).not.toContain('`page-warn`');
    expect(md).not.toContain('`page-na`');
  });
});
