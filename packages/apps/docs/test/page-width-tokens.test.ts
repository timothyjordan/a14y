import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * TJ-1426. Guards the geometry tokens at source level. The rendered
 * behaviour is covered by e2e/page-width.spec.ts, which blocks webfonts
 * and compares widths; this catches the mistake earlier and explains
 * itself at the place someone would make it.
 */

const css = readFileSync(path.resolve(__dirname, '../src/styles/global.css'), 'utf-8');
const tokens = css.slice(css.indexOf('/* Geometry */'), css.indexOf('--radius:'));
/**
 * Declarations only. The comment above `--max-width-prose` explains the
 * bug by naming the old `68ch` value, so a check for "no ch here" has
 * to ignore comments or it flags its own documentation.
 */
const tokenDeclarations = tokens.replace(/\/\*[\s\S]*?\*\//g, '');

describe('page-width tokens (TJ-1426)', () => {
  it('defines the prose column in px, not ch', () => {
    // `ch` is the width of the current font's `0` glyph, so a container
    // sized in ch changes width when the webfont loads. Atkinson
    // Hyperlegible Next is wide enough that this was a 55px reflow on
    // every prose page.
    expect(tokenDeclarations).toMatch(/--max-width-prose:\s*748px;/);
    expect(tokenDeclarations).not.toMatch(/--max-width-prose:\s*[\d.]+ch/);
  });

  it('defines the wide column in px', () => {
    expect(tokenDeclarations).toMatch(/--max-width-wide:\s*1120px;/);
  });

  it('has no ch-based geometry token left to pick up by mistake', () => {
    // `--max-width: 72ch` used to live here, unreferenced anywhere in
    // the repo: the same trap waiting for the next person who wants a
    // "reading column".
    expect(tokenDeclarations).not.toMatch(/[\d.]+ch/);
  });

  it('sizes the page container from the tokens rather than a literal', () => {
    expect(css).toMatch(/main\.container\s*\{[^}]*max-width:\s*var\(--max-width-prose\)/);
    expect(css).toMatch(
      /main\.container\.container--wide\s*\{\s*max-width:\s*var\(--max-width-wide\)/,
    );
  });

  it('still allows ch for inner text measures', () => {
    // Not a blanket ban. Leads, captions, and paragraph blocks size in
    // ch on purpose: tracking the font is the point, and they sit
    // inside the container so they cannot move the page width.
    expect(css).toMatch(/max-width:\s*\d+ch/);
  });
});
