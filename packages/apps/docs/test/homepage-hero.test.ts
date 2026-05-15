import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(
  path.resolve(__dirname, '../src/pages/index.astro'),
  'utf-8',
);

describe('homepage hero (TJ-439)', () => {
  it('eyebrow pairs the version pin with the three-noun positioning line', () => {
    expect(page).toMatch(/<span class="eyebrow-pin">v\{latest\}<\/span>/);
    expect(page).toMatch(
      /<span>Open spec, open tools, public leaderboard\.<\/span>/,
    );
    expect(page).not.toMatch(/Lighthouse for AI agents/);
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

  it('does not render the public-leaderboard teaser section', () => {
    expect(page).not.toMatch(/id="leaderboard-heading"/);
    expect(page).not.toMatch(/A public leaderboard, not a private score/);
  });

  it('Tools section intro emphasizes open tools + speed + CI', () => {
    expect(page).toMatch(/Open tools, three surfaces\./);
    expect(page).toMatch(/Sub-second per page, CI-friendly/);
  });

  it('BaseLayout meta title is "a14y: Agent readability for the web"', () => {
    expect(page).toMatch(/title="a14y: Agent readability for the web"/);
    expect(page).not.toMatch(/title="a14y · Lighthouse for AI agents"/);
  });

  it('does not import research-data on the homepage', () => {
    expect(page).not.toMatch(/from\s*['"]~\/lib\/research-data['"]/);
    expect(page).not.toMatch(/getLeaderboard\(\)/);
  });
});
