#!/usr/bin/env tsx
// Build per-site OG screenshots into
// packages/apps/docs/public/leaderboard/<slug>/og.png.
//
// Wired into the @a14y/docs `prebuild` hook (see package.json) so
// every `astro build` regenerates only the slugs whose fingerprint
// changed since the previous run. The fingerprint covers every value
// that ends up visible in the badge plus a content hash of the three
// template files (build-badge-html.ts, badge-style.ts,
// build-site-og.ts) so any visual code change invalidates every slug.
//
// First-run setup (locally): `npx playwright install chromium` once.
// CI: handled by .github/workflows/deploy-docs.yml.

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import type { BadgeData, SiteRun } from '@a14y/core';
import { buildBadgeHtml } from '../src/lib/build-badge-html';
import {
  OG_HEIGHT,
  OG_WIDTH,
  renderBadgeOgHtml,
} from '../src/lib/build-site-og';
import {
  getLeaderboard,
  type LeaderboardEntry,
} from '../src/lib/research-data';
import { listSiteRunSlugs, loadSiteRun } from '../src/lib/site-run';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = resolve(here, '..', 'public');
const OUT_DIR = resolve(PUBLIC_DIR, 'leaderboard');
const MANIFEST_PATH = resolve(OUT_DIR, '.og-manifest.json');

// Files whose content controls every screenshot — any byte change
// here invalidates the entire cache.
const TEMPLATE_FILES = [
  resolve(here, '..', 'src', 'lib', 'build-badge-html.ts'),
  resolve(here, '..', 'src', 'lib', 'badge-style.ts'),
  resolve(here, '..', 'src', 'lib', 'build-site-og.ts'),
];

interface ManifestV1 {
  version: 1;
  templateHash: string;
  slugs: Record<string, string>; // slug -> data fingerprint
}

function hashContent(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

function templateFilesHash(): string {
  const h = createHash('sha256');
  for (const p of TEMPLATE_FILES) {
    h.update(p);
    h.update(readFileSync(p));
  }
  return h.digest('hex').slice(0, 16);
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function isoDateOnly(s: string): string {
  return s.slice(0, 10);
}

function badgeDataFor(entry: LeaderboardEntry, run: SiteRun): BadgeData {
  return {
    score: run.summary.score,
    scorecardVersion: run.scorecardVersion,
    applicable: run.summary.applicable,
    total: run.summary.total,
    passed: run.summary.passed,
    failed: run.summary.failed,
    warned: run.summary.warned,
    errored: run.summary.errored,
    na: run.summary.na,
    date: isoDateOnly(run.finishedAt),
    mode: run.mode,
    url: entry.url,
    theme: 'light',
  };
}

function dataFingerprint(data: BadgeData, siteName: string): string {
  // Stable JSON ordering: list the keys explicitly so a JSON.stringify
  // implementation change can't shift the hash.
  const payload = JSON.stringify({
    siteName,
    score: data.score,
    scorecardVersion: data.scorecardVersion,
    applicable: data.applicable,
    total: data.total,
    passed: data.passed,
    failed: data.failed,
    warned: data.warned,
    errored: data.errored,
    na: data.na,
    date: data.date,
    mode: data.mode,
    url: data.url,
    host: hostOf(data.url),
  });
  return hashContent(payload);
}

function loadManifest(templateHash: string): ManifestV1 {
  if (!existsSync(MANIFEST_PATH)) {
    return { version: 1, templateHash, slugs: {} };
  }
  try {
    const raw = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestV1;
    if (raw.version !== 1 || raw.templateHash !== templateHash) {
      // Template changed — invalidate everything.
      return { version: 1, templateHash, slugs: {} };
    }
    return raw;
  } catch {
    return { version: 1, templateHash, slugs: {} };
  }
}

function saveManifest(m: ManifestV1): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(m, null, 2) + '\n', 'utf8');
}

function pngPath(slug: string): string {
  return resolve(OUT_DIR, slug, 'og.png');
}

async function screenshotOne(
  browser: Browser,
  slug: string,
  data: BadgeData,
): Promise<void> {
  const html = renderBadgeOgHtml(data);
  const page = await browser.newPage({
    viewport: { width: OG_WIDTH, height: OG_HEIGHT },
    deviceScaleFactor: 1,
  });
  try {
    // setContent with networkidle waits for the Google Fonts CSS +
    // font files to finish loading so the screenshot has the right
    // typography. The badge itself has no JS, no images, no other
    // network — fonts are the only meaningful network event.
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30_000 });
    // Belt-and-suspenders: wait until document.fonts is fully ready.
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: OG_WIDTH, height: OG_HEIGHT },
    });
    const target = pngPath(slug);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, buf);
  } finally {
    await page.close();
  }
}

function pruneOrphans(eligible: Set<string>, manifest: ManifestV1): number {
  if (!existsSync(OUT_DIR)) return 0;
  let removed = 0;
  // Remove manifest entries for slugs no longer published.
  for (const slug of Object.keys(manifest.slugs)) {
    if (!eligible.has(slug)) {
      delete manifest.slugs[slug];
    }
  }
  // Remove on-disk directories that aren't in the eligible set. Skip
  // the manifest file itself (which lives at OUT_DIR/.og-manifest.json,
  // not in a per-slug directory).
  for (const ent of readdirSync(OUT_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (eligible.has(ent.name)) continue;
    const dir = resolve(OUT_DIR, ent.name);
    rmSync(dir, { recursive: true, force: true });
    removed += 1;
  }
  return removed;
}

async function main(): Promise<void> {
  const templateHash = templateFilesHash();
  const manifest = loadManifest(templateHash);
  manifest.templateHash = templateHash;

  const published = new Set(listSiteRunSlugs());
  const entries = getLeaderboard().filter((e) => published.has(e.slug));
  const eligible = new Set(entries.map((e) => e.slug));

  type Job = { slug: string; data: BadgeData; fingerprint: string };
  const jobs: Job[] = [];
  let cached = 0;

  for (const entry of entries) {
    const run = await loadSiteRun(entry.slug);
    if (!run) continue;
    const data = badgeDataFor(entry, run);
    const fp = dataFingerprint(data, entry.name);
    const hit = manifest.slugs[entry.slug] === fp && existsSync(pngPath(entry.slug));
    if (hit) {
      cached += 1;
      continue;
    }
    jobs.push({ slug: entry.slug, data, fingerprint: fp });
  }

  const pruned = pruneOrphans(eligible, manifest);

  if (jobs.length === 0) {
    console.log(
      `  build-site-og  →  ${cached} cached, 0 regenerated, ${pruned} pruned (no browser launched)`,
    );
    saveManifest(manifest);
    return;
  }

  const t0 = Date.now();
  const browser = await chromium.launch();
  try {
    let done = 0;
    for (const job of jobs) {
      await screenshotOne(browser, job.slug, job.data);
      manifest.slugs[job.slug] = job.fingerprint;
      done += 1;
      if (done === 1 || done % 25 === 0 || done === jobs.length) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  build-site-og  →  ${done}/${jobs.length} (${elapsed}s)`);
      }
    }
  } finally {
    await browser.close();
  }
  saveManifest(manifest);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `  build-site-og  →  ${cached} cached, ${jobs.length} regenerated, ${pruned} pruned in ${elapsed}s`,
  );
}

main().catch((err) => {
  console.error('build-site-og failed:', err);
  if (err?.message?.includes("Executable doesn't exist")) {
    console.error(
      '  → run `npx playwright install chromium` once, then retry.',
    );
  }
  process.exit(1);
});
