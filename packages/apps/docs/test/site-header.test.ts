import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * TJ-1349. Source-level guards for the header. The rendered behaviour
 * (no overflow at any width, the header-height token matching reality)
 * is covered by e2e/site-header.spec.ts; these catch the mistake at the
 * place someone would make it and explain why the numbers are what they
 * are.
 */

const layout = readFileSync(
  path.resolve(__dirname, '../src/layouts/BaseLayout.astro'),
  'utf-8',
);
const css = readFileSync(path.resolve(__dirname, '../src/styles/global.css'), 'utf-8');

describe('header markup (TJ-1349)', () => {
  it('keeps the theme toggle out of the primary nav', () => {
    // It is a display preference, not a destination. Being a sibling of
    // <nav> is what lets it stay on the brand row when the nav wraps.
    const navBlock = layout.slice(
      layout.indexOf('<nav class="site-nav"'),
      layout.indexOf('</nav>'),
    );
    expect(navBlock).not.toContain('theme-toggle');
    expect(layout).toMatch(/<\/nav>\s*<button[\s\S]*?class="theme-toggle"/);
  });

  it('orders the DOM brand, destinations, then preference', () => {
    // Desktop renders in exactly this order, so tab order matches the
    // visual one there. On phones the toggle is lifted to the brand row
    // visually while keeping its DOM position, which is the one place
    // the two differ; that is a deliberate trade for the breakpoint
    // with far less traffic.
    const brand = layout.indexOf('class="brand"');
    const nav = layout.indexOf('<nav class="site-nav"');
    const toggle = layout.indexOf('class="theme-toggle"');
    expect(brand).toBeLessThan(nav);
    expect(nav).toBeLessThan(toggle);
  });

  it('still labels the primary nav for assistive tech', () => {
    expect(layout).toContain('<nav class="site-nav" aria-label="Primary">');
  });
});

describe('header breakpoints (TJ-1349)', () => {
  it('hides the secondary links below 800px, not 640px', () => {
    // The full nav needs 779px. The old 640px threshold left 641-767px
    // overflowing by up to 51px, which covers tablets and half-width
    // laptop windows.
    expect(css).toMatch(
      /@media \(max-width: 799px\)\s*\{[\s\S]*?\.site-nav a\[data-secondary\] \{ display: none; \}/,
    );
    expect(css).not.toMatch(
      /@media \(max-width: 640px\)\s*\{[^}]*\.site-nav a\[data-secondary\]/,
    );
  });

  it('wraps the nav to its own row below 560px', () => {
    const block = css.slice(css.indexOf('@media (max-width: 559px)'));
    expect(block).toMatch(/\.site-header-inner \{[\s\S]*?flex-wrap: wrap;/);
    expect(block).toMatch(/\.site-nav \{[\s\S]*?width: 100%;/);
  });

  it('restates the header-height token wherever the header grows', () => {
    // The token offsets in-page anchors and the leaderboard's sticky
    // table head. A two-row header with a one-row token tucks both
    // under the header.
    const block = css.slice(css.indexOf('@media (max-width: 559px)'));
    expect(block).toMatch(/--site-header-height:\s*95px/);
  });

  it('keeps a wrap safety net on the nav itself', () => {
    // So a future nav item costs a taller header rather than a
    // sideways-scrolling document.
    expect(css).toMatch(/\.site-nav \{[\s\S]*?flex-wrap: wrap;[\s\S]*?\}/);
  });
});

describe('shrinkable grid and flex items (TJ-1349)', () => {
  it('lets tool cards shrink below their longest command', () => {
    // Grid and flex items default to `min-width: auto`, which held
    // these at 379px and scrolled the homepage sideways below ~435px.
    expect(css).toMatch(/\.tool-card \{[\s\S]*?min-width: 0;/);
  });

  it('lets the findings pair collapse below its track minimum', () => {
    // A bare minmax(300px, 1fr) cannot fit a 284px content box.
    expect(css).toMatch(
      /\.finding-pair \{[\s\S]*?minmax\(min\(300px, 100%\), 1fr\)/,
    );
  });
});
