#!/usr/bin/env node
// Compose the Open Graph preview image for a14y.dev. Produces a 1200×630
// PNG centered on the lockup with the site tagline underneath.
//
// Run on demand (not wired into `astro build`) because it's deterministic
// and we commit the output so CI never has to render it.

import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const brandDir = resolve(here, '../public/brand');

const TAGLINE = 'Agent readability for the web.';
const BG = '#fafafa';
const INK = '#1b2763';

async function main() {
  const lockupSvg = await readFile(resolve(brandDir, 'logo-lockup.svg'), 'utf8');
  // Strip the outer <svg> tag — we splice the inner markup into the OG
  // canvas below so transforms compose cleanly with the rest of the
  // scene (and we avoid nested <svg> complications).
  const inner = lockupSvg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');

  // Lockup viewBox is 480×128; scale 1.7x and center horizontally, place
  // vertically so the composition breathes above the tagline.
  const scale = 1.7;
  const lockupW = 480 * scale;
  const lockupX = (1200 - lockupW) / 2;
  const lockupY = 140;

  const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <g transform="translate(${lockupX}, ${lockupY}) scale(${scale})">${inner}</g>
  <text x="600" y="500" text-anchor="middle"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"
    font-size="42" font-weight="500" fill="${INK}" letter-spacing="-0.5">${TAGLINE}</text>
</svg>`.trim();

  const out = resolve(brandDir, 'og-image.png');
  await sharp(Buffer.from(ogSvg), { density: 200 }).png().toFile(out);
  console.log('  og-image  →  public/brand/og-image.png (1200×630)');
}

main().catch((err) => {
  console.error('build-og-image failed:', err);
  process.exit(1);
});
