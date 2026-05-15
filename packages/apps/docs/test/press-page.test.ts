import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(
  path.resolve(__dirname, '../src/pages/press.astro'),
  'utf-8',
);
const onepager = readFileSync(
  path.resolve(__dirname, '../src/content/pages/press-product-onepager.md'),
  'utf-8',
);
const baseLayout = readFileSync(
  path.resolve(__dirname, '../src/layouts/BaseLayout.astro'),
  'utf-8',
);

describe('press.astro (TJ-440)', () => {
  it('uses BaseLayout', () => {
    expect(page).toMatch(/import\s+BaseLayout\s+from\s+['"]~\/layouts\/BaseLayout\.astro['"]/);
  });

  it('declares the H1', () => {
    expect(page).toMatch(/<h1>[\s\S]*?Press kit[\s\S]*?<\/h1>/);
  });

  it('renders the 7 sections in the post-critique order', () => {
    // Each section h2 by id. Order matters: hero -> terminal -> one-pager
    // -> comp -> leaderboard -> assets -> contact.
    const sectionIds = [
      'cli-heading',
      'onepager-heading',
      'comp-heading',
      'leaderboard-heading',
      'assets-heading',
      'contact-heading',
    ];
    let cursor = 0;
    for (const id of sectionIds) {
      const idx = page.indexOf(`id="${id}"`, cursor);
      expect(idx, `expected id="${id}" after offset ${cursor}`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it('does not include a founder section (dropped per critique)', () => {
    expect(page).not.toMatch(/id="founder-heading"/);
    expect(page).not.toMatch(/press-founder/);
    expect(page).not.toMatch(/timothy-jordan\.jpg/);
    expect(page).not.toMatch(/getEntry\(['"]pages['"], ['"]press-bio['"]\)/);
  });

  it('embeds the press contact email (matches existing public footprint)', () => {
    expect(page).toContain('mailto:${pressEmail}');
    expect(page).toContain("'agentreadability@gmail.com'");
  });

  it('renders all 5 comp-table rows verbatim from launch-plan.md', () => {
    const rows = [
      'Open implementation',
      'Public leaderboard',
      'Per-page scores',
      'CI-friendly (sub-sec)',
      'Vendor-neutral',
    ];
    for (const row of rows) {
      expect(page).toContain(row);
    }
    expect(page).toMatch(/<th[^>]*>a14y<\/th>/);
    expect(page).toMatch(/<th[^>]*>ora\.run<\/th>/);
    expect(page).toMatch(/<th[^>]*>Cloudflare<\/th>/);
    expect(page).toMatch(/<th[^>]*>agentready\.dev<\/th>/);
  });

  it('renders a comp-table legend (✓ yes · ✗ no · ~ partial)', () => {
    expect(page).toMatch(/press-comp-legend/);
    expect(page).toContain('yes');
    expect(page).toContain('no');
    expect(page).toContain('partial');
  });

  it('embeds the leaderboard via the existing research components (single source of truth)', () => {
    expect(page).toMatch(/import\s+LeaderboardTable\s+from\s+['"]~\/components\/research\/LeaderboardTable\.astro['"]/);
    expect(page).toMatch(/import\s+ScoreHistogram\s+from\s+['"]~\/components\/research\/ScoreHistogram\.astro['"]/);
    expect(page).toMatch(/\.slice\(0,\s*10\)/);
    expect(page).toContain('getLeaderboard()');
    expect(page).toContain('a14y.dev/leaderboard/');
  });

  it('embeds the captured CLI output through TerminalWindow', () => {
    expect(page).toMatch(/import\s+TerminalWindow\s+from\s+['"]~\/components\/TerminalWindow\.astro['"]/);
    expect(page).toMatch(/import\s+cliOutput\s+from\s+['"]~\/data\/press-cli-output\.txt\?raw['"]/);
    expect(page).toMatch(/<TerminalWindow\s+text=\{cliOutput\}/);
  });

  it('promotes the OG image to its own feature card and lists all 6 logo SVGs', () => {
    expect(page).toMatch(/press-asset-card--feature/);
    expect(page).toContain('og-image.png');
    const filenames = [
      'logo-mark.svg',
      'logo-mark--dark.svg',
      'logo-lockup.svg',
      'logo-lockup--dark.svg',
      'logo-wordmark.svg',
      'logo-wordmark--dark.svg',
    ];
    for (const f of filenames) {
      expect(page).toContain(f);
    }
  });

  it('imports the one-pager from the pages content collection', () => {
    expect(page).toContain("getEntry('pages', 'press-product-onepager')");
  });

  it('pins last_updated to the scorecard release date, not new Date()', () => {
    // The helper is the source of truth; the executed expression must not
    // call `new Date()`. Strip line comments before checking, since the
    // module comment explains *why* we avoid it.
    const codeOnly = page.replace(/^---[\s\S]*?^---/m, (frontmatter) =>
      frontmatter.replace(/^\s*\/\/.*$/gm, ''),
    );
    expect(page).toMatch(/getScorecardByVersion\(latestScorecard\)\.releasedAt/);
    expect(codeOnly).not.toMatch(/new\s+Date\s*\(/);
  });

  it('one-pager covers the 5 framings (problem, spec, scorecard, tools, proof)', () => {
    expect(onepager).toMatch(/\*\*The problem\.\*\*/);
    expect(onepager).toMatch(/\*\*The spec\.\*\*/);
    expect(onepager).toMatch(/\*\*The scorecard\.\*\*/);
    expect(onepager).toMatch(/\*\*The tools\.\*\*/);
    expect(onepager).toMatch(/\*\*The proof\.\*\*/);
  });

  it('contains no em dashes in the page or the one-pager (PRODUCT.md ban)', () => {
    expect(page).not.toMatch(/—/);
    expect(onepager).not.toMatch(/—/);
  });

  it('header brand mark renders light + dark variants for theme parity', () => {
    expect(baseLayout).toMatch(/brand-mark--light/);
    expect(baseLayout).toMatch(/brand-mark--dark/);
    expect(baseLayout).toMatch(/logo-mark--dark\.svg/);
  });

  it('header nav links to /press/', () => {
    expect(baseLayout).toMatch(/href=\{`\$\{base\}\/press\/`\}/);
  });
});
