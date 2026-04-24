#!/usr/bin/env node
// Capture the three Chrome Web Store screenshots by driving system
// Chrome via puppeteer-core. We render the real popup.html (same file
// that ships in the extension) at its natural 340px width, then
// compose it onto a 1280×800 branded backdrop via sharp.
//
// Puppeteer-core is NOT a declared dependency — it's temp-installed
// before running this script and removed afterwards. The screenshots
// themselves are committed; this script only exists so the next
// release can re-generate them deterministically.
//
// Usage: node scripts/capture-screenshots.mjs
//
// Required: macOS Chrome at the standard path. On Linux/Windows update
// `CHROME_PATH` below.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import sharp from 'sharp';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const extRoot = resolve(here, '..');
const distDir = resolve(extRoot, 'dist');
const outDir = resolve(extRoot, 'store/screenshots');

// Vite emits absolute asset paths (/assets/popup-xxx.css) that only
// resolve under chrome-extension://. We serve dist/ over localhost so
// those paths work end-to-end.
function startDistServer() {
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.json': 'application/json',
  };
  const server = createServer((req, res) => {
    const p = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = resolve(distDir, `.${p}`);
    if (!file.startsWith(distDir) || !existsSync(file) || statSync(file).isDirectory()) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    const ext = file.slice(file.lastIndexOf('.'));
    res.setHeader('content-type', MIME[ext] || 'application/octet-stream');
    createReadStream(file).pipe(res);
  });
  return new Promise((resolveFn) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolveFn({ server, port });
    });
  });
}

const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Canvas: 1280×800 with a soft neutral backdrop — matches a14y.dev's
// --bg token so screenshots read as 'the same product, in context'.
const BG = '#fafafa';
const MUTED = '#6e6e73';
const BORDER = '#e5e5ea';
const INK = '#1b2763';

// Each state injects some CSS/DOM tweaks into the popup before
// screenshotting so the popup renders as if an audit were in that
// phase — no background SW, no chrome.* API, no network.
const STATES = [
  {
    name: 'idle',
    caption: 'Open the popup, pick a scorecard, go.',
    script: () => {
      const url = document.getElementById('current-url');
      if (url) url.textContent = 'https://a14y.dev/';
      const sc = document.getElementById('scorecard');
      if (sc) {
        sc.innerHTML = '<option>v0.2.0 (latest)</option>';
      }
      document.querySelectorAll('button').forEach((b) => (b.disabled = false));
    },
  },
  {
    name: 'running',
    caption: 'Live progress as a14y crawls the site.',
    script: () => {
      const url = document.getElementById('current-url');
      if (url) url.textContent = 'https://a14y.dev/';
      const sc = document.getElementById('scorecard');
      if (sc) sc.innerHTML = '<option>v0.2.0 (latest)</option>';
      const progress = document.getElementById('progress');
      if (progress) {
        progress.hidden = false;
        progress.value = 64;
      }
      const status = document.getElementById('status');
      if (status) status.textContent = 'Visited 8 pages — /scorecards/0.2.0/';
      document.querySelectorAll('button').forEach((b) => (b.disabled = true));
    },
  },
  {
    name: 'done',
    caption: 'A score you can point at and fix.',
    script: () => {
      const url = document.getElementById('current-url');
      if (url) url.textContent = 'https://a14y.dev/';
      const sc = document.getElementById('scorecard');
      if (sc) sc.innerHTML = '<option>v0.2.0 (latest)</option>';
      const result = document.getElementById('result');
      if (result) result.hidden = false;
      const score = document.getElementById('score');
      if (score) {
        score.textContent = '94/100';
        score.className = 'score-number good';
      }
      const meta = document.getElementById('score-meta');
      if (meta) meta.textContent = 'Scorecard v0.2.0 · 32/34 checks passed';
    },
  },
];

async function renderPopupState(browser, baseUrl, state) {
  const page = await browser.newPage();
  await page.setViewport({ width: 340, height: 600, deviceScaleFactor: 2 });
  // Force light mode — the default for most desktop Chrome users.
  // Tim can capture a follow-up dark-mode set later if wanted.
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.goto(`${baseUrl}/src/popup.html`, { waitUntil: 'networkidle0' });
  // The popup.ts init runs a chrome.* API it doesn't have in this
  // context; wait a beat for failed promises to settle, then overwrite
  // whatever state it managed to render.
  await new Promise((r) => setTimeout(r, 100));
  await page.evaluate(state.script);
  // Give layout a tick to settle after state mutation.
  await new Promise((r) => setTimeout(r, 50));
  const box = await page.evaluate(() => ({
    height: Math.ceil(document.body.scrollHeight),
    width: Math.ceil(document.body.scrollWidth),
  }));
  await page.setViewport({ width: box.width, height: box.height, deviceScaleFactor: 2 });
  const buffer = await page.screenshot({ type: 'png', omitBackground: false });
  await page.close();
  return { buffer, box };
}

function backdrop(caption) {
  // 1280×800 canvas with a big brand headline on the left, popup gets
  // pasted on the right. SVG is trivially composable with sharp and
  // handles fonts via librsvg's system-font fallback.
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
    <rect width="1280" height="800" fill="${BG}"/>
    <text x="88" y="340"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-size="60" font-weight="700" fill="${INK}" letter-spacing="-1.5">a14y</text>
    <text x="88" y="400"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-size="28" font-weight="500" fill="${INK}" letter-spacing="-0.4">Agent readability for the web.</text>
    <text x="88" y="450"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-size="18" font-weight="400" fill="${MUTED}" letter-spacing="0">${caption}</text>
    <line x1="88" y1="485" x2="160" y2="485" stroke="${BORDER}" stroke-width="2"/>
    <text x="88" y="530"
      font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
      font-size="15" fill="${MUTED}">a14y.dev</text>
  </svg>`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const { server, port } = await startDistServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--hide-scrollbars'],
  });
  try {
    for (const state of STATES) {
      const { buffer, box } = await renderPopupState(browser, baseUrl, state);
      // Popup was rendered at 2x DPR; we want it sharp on the final
      // 1280×800 so we scale-down by 0.625 (popup natural width 340 →
      // final-canvas width 425) which keeps it readable while leaving
      // room for the headline on the left.
      const popupFinalW = 420;
      const popupFinalH = Math.round((popupFinalW / box.width) * box.height);
      const popupSharp = await sharp(buffer)
        .resize(popupFinalW * 2, popupFinalH * 2)
        .resize({ width: popupFinalW, height: popupFinalH })
        .png()
        .toBuffer();
      const canvas = await sharp(backdrop(state.caption))
        .composite([
          {
            input: popupSharp,
            left: 1280 - popupFinalW - 120,
            top: Math.round((800 - popupFinalH) / 2),
          },
        ])
        .resize(1280, 800)
        .png()
        .toBuffer();
      const outPath = resolve(outDir, `${state.name}.png`);
      await writeFile(outPath, canvas);
      console.log(`  ${state.name.padEnd(8)} → store/screenshots/${state.name}.png (1280×800)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('capture-screenshots failed:', err);
  process.exit(1);
});
