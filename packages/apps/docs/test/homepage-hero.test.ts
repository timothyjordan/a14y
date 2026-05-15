import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(
  path.resolve(__dirname, '../src/pages/index.astro'),
  'utf-8',
);

describe('homepage hero (TJ-439)', () => {
  it('eyebrow is the single positioning one-liner', () => {
    expect(page).toMatch(
      /<span>Open spec, open tools, public leaderboard\. Lighthouse for AI agents\.<\/span>/,
    );
    expect(page).not.toMatch(/<span class="eyebrow-pin">v\{latest\}<\/span>/);
  });

  it('keeps the canonical h1', () => {
    expect(page).toMatch(/<h1 id="hero-heading">Agent readability for the web<\/h1>/);
  });

  it('lead paragraph uses the "open source project" framing', () => {
    expect(page).toMatch(/open source project making the web readable by those agents/);
  });

  it('includes a Star-the-GitHub button pointing at github.com/timothyjordan/a14y', () => {
    expect(page).toMatch(
      /href="https:\/\/github\.com\/timothyjordan\/a14y"[\s\S]*?Star the GitHub →/,
    );
  });

  it('CTA-row DOM order is CWS badge → Star the GitHub → Read the spec', () => {
    const cwsIdx = page.indexOf('class="cws-badge"');
    const githubIdx = page.indexOf('Star the GitHub →');
    const specIdx = page.indexOf('Read the spec →');
    expect(cwsIdx).toBeGreaterThan(-1);
    expect(githubIdx).toBeGreaterThan(-1);
    expect(specIdx).toBeGreaterThan(-1);
    expect(cwsIdx).toBeLessThan(githubIdx);
    expect(githubIdx).toBeLessThan(specIdx);
  });

  it('renders the public-leaderboard teaser section linking to /research/', () => {
    expect(page).toMatch(/id="leaderboard-heading"/);
    expect(page).toMatch(/A public leaderboard, not a private score/);
    expect(page).toMatch(/Browse the leaderboard →/);
    expect(page).toMatch(/href=\{`\$\{base\}\/research\/`\}/);
  });

  it('Tools section intro emphasizes open tools + speed + CI', () => {
    expect(page).toMatch(/Open tools, three surfaces\./);
    expect(page).toMatch(/Sub-second per page, CI-friendly/);
  });

  it('BaseLayout meta title + description use the new positioning', () => {
    expect(page).toMatch(/title="a14y · Lighthouse for AI agents"/);
    expect(page).toMatch(/description="Lighthouse for AI agents\./);
  });

  it('loads the leaderboard site count from research-data', () => {
    expect(page).toMatch(
      /import\s*\{[^}]*getLeaderboard[^}]*\}\s*from\s*['"]~\/lib\/research-data['"]/,
    );
    expect(page).toMatch(/leaderboardSiteCount\s*=\s*getLeaderboard\(\)\.length/);
    expect(page).toMatch(/Compare\s*[\s\S]*?against \{leaderboardSiteCount\} sites/);
  });
});
