import { describe, expect, it, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = path.resolve(
  fileURLToPath(import.meta.url),
  '../../',
);

let aboutSource = '';
let layoutSource = '';

beforeAll(async () => {
  aboutSource = await fs.readFile(
    path.join(docsRoot, 'src/pages/about.astro'),
    'utf8',
  );
  layoutSource = await fs.readFile(
    path.join(docsRoot, 'src/layouts/BaseLayout.astro'),
    'utf8',
  );
});

describe('about page', () => {
  it('renders the first-person hero with the open-spec key message', () => {
    // The Linear ticket spells out the key message Timothy wants on
    // the page; if a future copy edit accidentally drops the
    // "open-source spec" framing, this test catches it.
    expect(aboutSource).toMatch(/Hi, I'm Timothy/);
    expect(aboutSource).toMatch(/agent-led growth and agent readability/);
    expect(aboutSource).toMatch(/open-source spec/);
  });

  it('exposes a primary hire CTA to timothyjordan.com', () => {
    // The About page's whole job is to convert "tell me about a14y"
    // into "hire me for advising". That CTA must remain on the page
    // and must point to the personal site, not a mailto or a form.
    expect(aboutSource).toContain('https://timothyjordan.com');
    expect(aboutSource).toMatch(/Hire me/);
  });

  it('uses BaseLayout with the About title and a description', () => {
    expect(aboutSource).toMatch(/<BaseLayout[\s\S]*title="About · a14y"/);
    expect(aboutSource).toMatch(/description="[^"]+"/);
  });

  it('reuses existing design-system classes (no bespoke hero or button styles)', () => {
    // The About page must look like the rest of the site. If
    // someone adds a new .about-hero or .about-btn class, this test
    // flags it so we keep using .hero / .btn / .section instead.
    expect(aboutSource).toMatch(/class="hero"/);
    expect(aboutSource).toMatch(/class="btn btn--primary"/);
    expect(aboutSource).toMatch(/class="btn btn--ghost"/);
    expect(aboutSource).toMatch(/class="section/);
  });
});

describe('BaseLayout footer', () => {
  it('links to /about/ from the Read column', () => {
    // The About page is intentionally footer-nav only (the primary
    // header stays lean). This assertion catches accidental removal
    // of the link during future footer refactors.
    expect(layoutSource).toMatch(
      /<a href=\{`\$\{base\}\/about\/`\}>About<\/a>/,
    );
  });
});
