#!/usr/bin/env node
// Render PNG icons for the Chrome extension manifest from the canonical
// brand SVGs in the docs package. Run via the `prebuild` npm hook so a
// plain `vite build` always picks up fresh icons, but also idempotent if
// run directly.
//
// Inputs:  packages/apps/docs/public/brand/logo-mark{,-16,-32,-48}.svg
// Outputs: packages/apps/extension/src/icons/{16,32,48,128}.png
//          packages/apps/extension/src/icons/logo-mark.svg (popup copy)

import sharp from 'sharp';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const extRoot = resolve(here, '..');
const brandDir = resolve(extRoot, '../../../packages/apps/docs/public/brand');
const iconsDir = resolve(extRoot, 'src/icons');

const SIZES = [16, 32, 48, 128];

async function renderIcon(size) {
  // Use a size-specific variant when available so small icons ship the
  // simplified composition (readable at 16px); fall back to the full
  // mark for larger sizes.
  const specific = resolve(brandDir, `logo-mark-${size}.svg`);
  const fallback = resolve(brandDir, 'logo-mark.svg');
  let svg;
  let src = specific;
  try {
    svg = await readFile(specific);
  } catch {
    svg = await readFile(fallback);
    src = fallback;
  }
  // density=800 oversamples the vector so the downscale to <size>px is
  // crisp even for small icons where aliasing matters most.
  const out = resolve(iconsDir, `${size}.png`);
  await sharp(svg, { density: 800 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  return { size, src: src.replace(`${brandDir}/`, ''), out: out.replace(`${extRoot}/`, '') };
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const results = await Promise.all(SIZES.map(renderIcon));
  await copyFile(resolve(brandDir, 'logo-mark.svg'), resolve(iconsDir, 'logo-mark.svg'));
  for (const { size, src, out } of results) {
    console.log(`  ${String(size).padStart(3)}  ${src}  →  ${out}`);
  }
  console.log(`  svg       logo-mark.svg  →  src/icons/logo-mark.svg`);
}

main().catch((err) => {
  console.error('build-icons failed:', err);
  process.exit(1);
});
