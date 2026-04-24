#!/usr/bin/env node
// Package the built extension into a Chrome Web Store-ready zip.
//
// Usage: node scripts/package-extension.mjs [--rebuild]
//   --rebuild   force `vite build` even if dist/ already exists
//
// The zip is written at the extension package root as
//   a14y-extension-<version>.zip
// so Tim can drag-and-drop it into the CWS developer dashboard.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import AdmZip from 'adm-zip';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const distDir = resolve(pkgRoot, 'dist');

const EXCLUDE = [
  /\.map$/,
  /\.DS_Store$/,
  /\.test\./,
  /(^|\/)test\//,
  /\.vitest-cache/,
  /(^|\/)\.[^/]+$/, // any dotfile
];

function shouldExclude(rel) {
  return EXCLUDE.some((re) => re.test(rel));
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = relative(distDir, abs);
    if (shouldExclude(rel)) continue;
    const s = statSync(abs);
    if (s.isDirectory()) out.push(...walk(abs));
    else out.push({ abs, rel, size: s.size });
  }
  return out;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function main() {
  const rebuild = process.argv.includes('--rebuild');

  const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'));
  const version = pkg.version;

  if (rebuild || !existsSync(distDir)) {
    console.log(`▸ running vite build…`);
    execFileSync('npm', ['run', 'build'], { cwd: pkgRoot, stdio: 'inherit' });
  } else {
    console.log(`▸ reusing existing dist/ (pass --rebuild to force a fresh build)`);
  }

  const files = walk(distDir).sort((a, b) => a.rel.localeCompare(b.rel));
  if (files.length === 0) {
    console.error('dist/ is empty — did the build fail?');
    process.exit(1);
  }

  // Sanity-check that the pieces the Chrome Web Store cares about are
  // present before we hand Tim a zip that would be rejected on upload.
  const required = ['manifest.json', 'src/icons/16.png', 'src/icons/128.png', 'src/popup.html'];
  const missing = required.filter((r) => !files.find((f) => f.rel === r));
  if (missing.length) {
    console.error('missing required files in dist/:', missing);
    process.exit(1);
  }

  const zip = new AdmZip();
  for (const f of files) zip.addLocalFile(f.abs, dirname(f.rel) === '.' ? '' : dirname(f.rel));

  const zipName = `a14y-extension-${version}.zip`;
  const zipPath = resolve(pkgRoot, zipName);
  zip.writeZip(zipPath);

  const zipSize = statSync(zipPath).size;
  const totalBytes = files.reduce((n, f) => n + f.size, 0);

  console.log(`\n▸ packaged ${files.length} files (${formatSize(totalBytes)} → ${formatSize(zipSize)} zipped)`);
  for (const f of files) {
    console.log(`    ${f.rel.padEnd(56)}  ${formatSize(f.size).padStart(10)}`);
  }
  console.log(`\n✓ ${zipName}`);
}

try {
  main();
} catch (err) {
  console.error('package-extension failed:', err);
  process.exit(1);
}
