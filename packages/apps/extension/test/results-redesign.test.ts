import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const html = readFileSync(path.join(root, 'src/results.html'), 'utf-8');
const tokens = readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf-8');
const resultsCss = readFileSync(path.join(root, 'src/styles/results.css'), 'utf-8');

describe('results page redesign (TJ-211)', () => {
  it('uses the shared design-token stylesheet', () => {
    // results.css imports tokens.css so the docs-site language flows in.
    expect(resultsCss).toMatch(/@import\s+['"]\.\/tokens\.css['"]/);
    // results.html links the results bundle (not the popup stylesheet).
    expect(html).toMatch(/href="styles\/results\.css"/);
    expect(html).not.toMatch(/href="popup\.css"/);
  });

  it('renders a sticky site header with brand and theme toggle', () => {
    expect(html).toMatch(/<header[^>]+class="site-header"/);
    expect(html).toMatch(/class="site-header-inner"/);
    expect(html).toMatch(/class="brand"/);
    expect(html).toMatch(/id="theme-toggle"/);
    // Sticky positioning lives in the shared tokens, not inline.
    expect(tokens).toMatch(/\.site-header[^}]*position:\s*sticky/);
  });

  it('renders a hero block with eyebrow, h1, and URL pill', () => {
    expect(html).toMatch(/<section class="hero">[\s\S]*<span class="eyebrow">Report<\/span>[\s\S]*<h1>Agent Readability<\/h1>[\s\S]*<code id="report-url">/);
  });

  it('renders the score inside a .scorecard-callout', () => {
    expect(html).toMatch(/<section id="scorecard" class="scorecard-callout">/);
    expect(tokens).toMatch(/\.scorecard-callout/);
  });

  it('uses .check-list / .check-card components for site and page checks', () => {
    expect(html).toMatch(/<ul id="site-checks" class="check-list">/);
    expect(html).toMatch(/<ul id="page-checks" class="check-list">/);
    expect(tokens).toMatch(/\.check-card/);
    expect(tokens).toMatch(/\.check-card\.status-pass/);
    expect(tokens).toMatch(/\.check-card\.status-fail/);
  });

  it('collapses history into a <details> element', () => {
    expect(html).toMatch(/<details id="history-section"[^>]*class="history-section"/);
    expect(html).toMatch(/<summary>Recent audits<\/summary>/);
  });

  it('includes a Mode column in the Recent audits header (TJ-213)', () => {
    expect(html).toMatch(/<th>Score<\/th><th>Mode<\/th><th>URL<\/th><th>Scorecard<\/th><th>When<\/th>/);
  });

  it('renders a site-footer with a14y.dev links', () => {
    expect(html).toMatch(/<footer class="site-footer">[\s\S]*a14y\.dev[\s\S]*Privacy/);
  });

  it('places download buttons directly under the scorecard, above site checks (TJ-212)', () => {
    // Use indexes within the report block to assert order.
    const idxScorecard = html.indexOf('id="scorecard"');
    const idxButtons = html.indexOf('id="export-buttons"');
    const idxSiteChecks = html.indexOf('id="site-checks"');
    expect(idxScorecard).toBeGreaterThan(-1);
    expect(idxButtons).toBeGreaterThan(idxScorecard);
    expect(idxSiteChecks).toBeGreaterThan(idxButtons);
    // Bottom row is gone — there's exactly one #export-buttons element.
    const matches = html.match(/id="export-buttons"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('uses an inline "Download:" label and short button names (TJ-213)', () => {
    const exportRow = html.match(/id="export-buttons"[\s\S]*?<\/div>/)?.[0] ?? '';
    expect(exportRow).toMatch(/<span class="cta-label">Download:<\/span>/);
    expect(exportRow).toMatch(/id="export-json"[^>]*>JSON</);
    expect(exportRow).toMatch(/id="export-markdown"[^>]*>Markdown</);
    expect(exportRow).toMatch(/id="export-prompt"[^>]*>Coding agent prompt</);
    // Old labels should not survive.
    expect(exportRow).not.toMatch(/Download JSON|Download Markdown|Download fix prompt/);
  });

  it('orders download buttons: Coding agent prompt, Markdown, JSON (TJ-213)', () => {
    const exportRow = html.match(/id="export-buttons"[\s\S]*?<\/div>/)?.[0] ?? '';
    const idxPrompt = exportRow.indexOf('id="export-prompt"');
    const idxMd = exportRow.indexOf('id="export-markdown"');
    const idxJson = exportRow.indexOf('id="export-json"');
    expect(idxPrompt).toBeGreaterThan(-1);
    expect(idxMd).toBeGreaterThan(idxPrompt);
    expect(idxJson).toBeGreaterThan(idxMd);
  });

  it('renders all action buttons with a unified .btn class (no primary/ghost split) (TJ-213)', () => {
    const popup = readFileSync(path.join(root, 'src/popup.html'), 'utf-8');
    expect(html).not.toMatch(/btn--primary|btn--ghost/);
    expect(popup).not.toMatch(/btn--primary|btn--ghost/);
  });

  it('makes the whole check-card a link via .check-card-link (TJ-213)', () => {
    expect(tokens).toMatch(/\.check-card-link\s*\{[^}]*display:\s*grid/);
    expect(tokens).toMatch(/\.check-card-link\s*\{[^}]*text-decoration:\s*none/);
    // Padding lives on the link so the whole li is the click target.
    expect(tokens).toMatch(/\.check-card-link\s*\{[^}]*padding:/);
  });

  it('check-card has button-like hover (background + lift)', () => {
    expect(tokens).toMatch(/\.check-card:hover\s*\{[^}]*transform:\s*translateY/);
  });

  it('does not hard-code colors except for white accents', () => {
    // The new design language depends entirely on CSS variables. The only
    // permitted literal is the white magnifying-glass body in the brand
    // mark SVG.
    const banned = ['#1d1d1f', '#6e6e73', '#34c759', '#ff3b30', '#1b2763', '#0066cc'];
    for (const hex of banned) expect(html).not.toContain(hex);
  });
});
