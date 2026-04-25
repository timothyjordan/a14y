#!/usr/bin/env node
// Render PNG icons for the Chrome extension manifest from the toolbar
// icon source SVG. Run via the `prebuild` npm hook so a plain `vite
// build` always picks up fresh icons, but also idempotent if run
// directly via `npm run icons`.
//
// Inputs:  packages/apps/extension/src/icons/source/toolbar-icon.svg
//          (optional) toolbar-icon-{16,32,48,128}.svg for size-specific
//          variants — useful when the wordmark needs to be tweaked at
//          smaller pixel sizes for legibility.
// Outputs: packages/apps/extension/src/icons/{16,32,48,128}.png

import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extRoot = resolve(here, '..');
const sourceDir = resolve(extRoot, 'src/icons/source');
const iconsDir = resolve(extRoot, 'src/icons');

const SIZES = [16, 32, 48, 128];

async function readSourceFor(size) {
  // Prefer size-specific override; fall back to the default tile.
  const specific = resolve(sourceDir, `toolbar-icon-${size}.svg`);
  const fallback = resolve(sourceDir, 'toolbar-icon.svg');
  try {
    return { svg: await readFile(specific), src: specific };
  } catch {
    return { svg: await readFile(fallback), src: fallback };
  }
}

async function renderIcon(size) {
  const { svg, src } = await readSourceFor(size);
  const out = resolve(iconsDir, `${size}.png`);
  // density=800 oversamples the vector so the downscale to <size>px is
  // crisp even for small icons where aliasing matters most.
  await sharp(svg, { density: 800 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  return {
    size,
    src: src.replace(`${extRoot}/`, ''),
    out: out.replace(`${extRoot}/`, ''),
  };
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const results = await Promise.all(SIZES.map(renderIcon));
  for (const { size, src, out } of results) {
    console.log(`  ${String(size).padStart(3)}  ${src}  →  ${out}`);
  }
}

main().catch((err) => {
  console.error('build-icons failed:', err);
  process.exit(1);
});
