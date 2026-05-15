import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(
  path.resolve(__dirname, '../src/pages/press.astro'),
  'utf-8',
);
const bio = readFileSync(
  path.resolve(__dirname, '../src/content/pages/press-bio.md'),
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

  it('renders all 8 required sections', () => {
    // Each section h2 by id, in order
    const sectionIds = [
      'onepager-heading',
      'comp-heading',
      'cli-heading',
      'leaderboard-heading',
      'assets-heading',
      'founder-heading',
      'contact-heading',
    ];
    for (const id of sectionIds) {
      expect(page).toContain(`id="${id}"`);
    }
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
    // All 4 competitors named in the column headers
    expect(page).toMatch(/<th[^>]*>a14y<\/th>/);
    expect(page).toMatch(/<th[^>]*>ora\.run<\/th>/);
    expect(page).toMatch(/<th[^>]*>Cloudflare<\/th>/);
    expect(page).toMatch(/<th[^>]*>agentready\.dev<\/th>/);
  });

  it('embeds the leaderboard via the existing research components (single source of truth)', () => {
    expect(page).toMatch(/import\s+LeaderboardTable\s+from\s+['"]~\/components\/research\/LeaderboardTable\.astro['"]/);
    expect(page).toMatch(/import\s+ScoreHistogram\s+from\s+['"]~\/components\/research\/ScoreHistogram\.astro['"]/);
    expect(page).toMatch(/\.slice\(0,\s*10\)/);
    expect(page).toContain('getLeaderboard()');
    expect(page).toContain('a14y.dev/research/');
  });

  it('embeds the captured CLI output through TerminalWindow', () => {
    expect(page).toMatch(/import\s+TerminalWindow\s+from\s+['"]~\/components\/TerminalWindow\.astro['"]/);
    expect(page).toMatch(/import\s+cliOutput\s+from\s+['"]~\/data\/press-cli-output\.txt\?raw['"]/);
    expect(page).toMatch(/<TerminalWindow\s+text=\{cliOutput\}/);
  });

  it('lists all 7 brand assets with download links', () => {
    const filenames = [
      'logo-mark.svg',
      'logo-mark--dark.svg',
      'logo-lockup.svg',
      'logo-lockup--dark.svg',
      'logo-wordmark.svg',
      'logo-wordmark--dark.svg',
      'og-image.png',
    ];
    for (const f of filenames) {
      expect(page).toContain(f);
    }
  });

  it('renders the founder headshot from public/press/timothy-jordan.jpg', () => {
    expect(page).toContain('/press/timothy-jordan.jpg');
    expect(page).toMatch(/alt="Timothy Jordan, creator of a14y"/);
    expect(page).toMatch(/download="timothy-jordan\.jpg"/);
  });

  it('imports founder bio + one-pager from the pages content collection', () => {
    expect(page).toContain("getEntry('pages', 'press-product-onepager')");
    expect(page).toContain("getEntry('pages', 'press-bio')");
  });

  it('bio includes the verbatim opening sentence sourced from timothyjordan.com', () => {
    // Markdown wraps lines, so collapse whitespace before matching prose.
    const bioFlat = bio.replace(/\s+/g, ' ');
    expect(bioFlat).toContain('Timothy Jordan is the creator of a14y.');
    expect(bioFlat).toContain(
      'two decades of experience working at the intersection of engineering and storytelling',
    );
    expect(bioFlat).toContain('VP of Developer Experience at Vercel');
  });

  it('one-pager covers the 5 framings (problem, spec, scorecard, tools, proof)', () => {
    expect(onepager).toMatch(/\*\*The problem\.\*\*/);
    expect(onepager).toMatch(/\*\*The spec\.\*\*/);
    expect(onepager).toMatch(/\*\*The scorecard\.\*\*/);
    expect(onepager).toMatch(/\*\*The tools\.\*\*/);
    expect(onepager).toMatch(/\*\*The proof\.\*\*/);
  });

  it('header nav links to /press/', () => {
    expect(baseLayout).toMatch(/href=\{`\$\{base\}\/press\/`\}/);
  });
});
