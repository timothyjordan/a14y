import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

describe('popup logo theme-aware colors (TJ-207)', () => {
  const html = readFileSync(path.join(root, 'src/popup.html'), 'utf-8');
  const css = readFileSync(path.join(root, 'src/popup.css'), 'utf-8');

  it('inlines the brand mark as SVG (not <img>)', () => {
    expect(html).toMatch(/<svg[^>]+class="brand-mark"/);
    expect(html).not.toMatch(/<img[^>]+class="brand-mark"/);
  });

  it('uses currentColor for navy strokes and fills, no #1b2763 literal', () => {
    // The inline SVG must NOT contain the navy literal — colors come from CSS.
    const svgMatch = html.match(/<svg[^>]+class="brand-mark"[\s\S]*?<\/svg>/);
    expect(svgMatch).toBeTruthy();
    const svg = svgMatch![0];
    expect(svg).not.toContain('#1b2763');
    expect(svg).toMatch(/stroke="currentColor"/);
    expect(svg).toMatch(/fill="currentColor"/);
    // White accent (magnifying glass body) is preserved literally.
    expect(svg).toMatch(/fill="#fff"/);
  });

  it('defines --logo-color: navy in light, brand cyan in dark', () => {
    // Light default
    expect(css).toMatch(/--logo-color: var\(--brand-ink\)/);
    // Dark via prefers-color-scheme
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)[\s\S]*?--logo-color: var\(--brand-cyan\)/);
    // Dark via explicit data-theme
    expect(css).toMatch(/\[data-theme='dark'\][\s\S]*?--logo-color: var\(--brand-cyan\)/);
  });

  it('.brand-mark consumes --logo-color via CSS color', () => {
    expect(css).toMatch(/\.brand-mark[^}]*color: var\(--logo-color\)/);
  });

  it('explicit data-theme=light beats prefers-color-scheme dark', () => {
    // Manual toggle (Task 4) sets data-theme='light' even on a dark OS.
    // The dark @media block must respect that override.
    expect(css).toMatch(/:root:not\(\[data-theme='light'\]\)/);
  });
});
