#!/usr/bin/env node
// Compose CWS-ready 1280×800 screenshots from manually-captured PNGs.
//
// Usage:
//   node scripts/compose-screenshots.mjs <input.png> <output-name> "<caption>"
//
//   <input.png>      Path to a raw screenshot you took in Chrome
//                    (popup, results page, docs check page, etc.)
//   <output-name>    Filename stem written to store/screenshots/
//                    (e.g. "idle" → store/screenshots/idle.png)
//   <caption>        One short line shown beneath the headline in the
//                    backdrop; sells what the screenshot is showing.
//
// What this does:
//   - sharp.trim() removes any uniform-color border (browser chrome
//     gutter, Desktop window padding, etc.)
//   - Fits the trimmed image onto the right side of the same branded
//     1280×800 backdrop the puppeteer-driven capture script uses, so
//     manually-captured shots match the existing CWS submission.
//   - Adds a hairline border and soft drop shadow under the image so
//     it reads as a discrete artifact rather than melting into the
//     paper background.
//
// This is a separate tool from capture-screenshots.mjs — that one
// drives a synthetic puppeteer run; this one composites what you
// already have. Use whichever fits the state you're capturing
// (popup states puppeteer can mock; results-page states need the
// real chrome.* APIs and so are easier to capture by hand).

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const extRoot = resolve(here, '..');
const outDir = resolve(extRoot, 'store/screenshots');

// Same palette + layout as capture-screenshots.mjs so manual and
// auto-captured frames are interchangeable in the CWS listing.
const BG = '#fafafa';
const MUTED = '#6e6e73';
const BORDER = '#e5e5ea';
const INK = '#1b2763';

const CANVAS_W = 1280;
const CANVAS_H = 800;

// Right-side artifact slot. The headline + caption sit on the left
// (x=88..400 roughly); the screenshot lives in this right column.
// Min/max bounds let popup-sized (narrow, tall) and results-sized
// (wider, often shorter) artifacts both look intentional without
// per-shape tuning.
const SLOT_RIGHT_MARGIN = 72;
const SLOT_TOP_MARGIN = 64;
const SLOT_BOTTOM_MARGIN = 64;
const SLOT_MAX_W = 700;
const SLOT_MIN_W = 380;

function backdropSvg(caption) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
    <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${BG}"/>
    <text x="88" y="340"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-size="60" font-weight="700" fill="${INK}" letter-spacing="-1.5">a14y</text>
    <text x="88" y="400"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-size="28" font-weight="500" fill="${INK}" letter-spacing="-0.4">Agent readability for the web.</text>
    <text x="88" y="450"
      font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      font-size="18" font-weight="400" fill="${MUTED}" letter-spacing="0">${escapeXml(caption)}</text>
    <line x1="88" y1="485" x2="160" y2="485" stroke="${BORDER}" stroke-width="2"/>
    <text x="88" y="530"
      font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
      font-size="15" fill="${MUTED}">a14y.dev</text>
  </svg>`);
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Produce a soft drop-shadow + 1px border layer, sized to the
// trimmed artifact, that sharp.composite can stack underneath the
// artifact itself. SVG is the cheapest way to render this without
// pulling in a heavier image lib.
function shadowFrameSvg(w, h) {
  // Offset and blur are gentle — the shot should feel "on the page",
  // not "floating in the air".
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w + 24}" height="${h + 24}" viewBox="0 0 ${w + 24} ${h + 24}">
    <defs>
      <filter id="drop" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
        <feOffset dx="0" dy="6" result="offsetblur" />
        <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
        <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
    <rect x="12" y="12" width="${w}" height="${h}" rx="10" ry="10"
      fill="${BG}" stroke="${BORDER}" stroke-width="1" filter="url(#drop)" />
  </svg>`);
}

async function main() {
  const [inputPath, outputName, captionRaw] = process.argv.slice(2);
  if (!inputPath || !outputName || !captionRaw) {
    console.error('usage: compose-screenshots.mjs <input.png> <output-name> "<caption>"');
    process.exit(2);
  }
  const caption = captionRaw.replace(/^"|"$/g, '');

  try {
    await access(inputPath);
  } catch {
    console.error(`input not found: ${inputPath}`);
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });

  // No auto-trim. The script assumes the input is already cropped to
  // the artifact you want shown — sharp.trim() makes too many wrong
  // calls on screenshots whose backgrounds aren't perfectly uniform
  // (window chrome, surface gradients, popup floating over a page).
  // If you need trimming, do it once in your image editor of choice.
  const trimmed = await readFile(inputPath);
  const trimmedMeta = await sharp(trimmed).metadata();
  const tw = trimmedMeta.width;
  const th = trimmedMeta.height;

  // Fit the trimmed shot into the right-side slot. Width gets capped
  // by SLOT_MAX_W; height gets capped by canvas minus top/bottom
  // margins. Aspect is preserved.
  const slotMaxW = SLOT_MAX_W;
  const slotMaxH = CANVAS_H - SLOT_TOP_MARGIN - SLOT_BOTTOM_MARGIN;

  let finalW = Math.min(tw, slotMaxW);
  let finalH = Math.round((finalW / tw) * th);
  if (finalH > slotMaxH) {
    finalH = slotMaxH;
    finalW = Math.round((finalH / th) * tw);
  }
  if (finalW < SLOT_MIN_W) {
    // Upscale tiny inputs a bit so the shot doesn't look lost on
    // the canvas. Trades some sharpness for visual presence.
    finalW = SLOT_MIN_W;
    finalH = Math.round((finalW / tw) * th);
  }

  // Resize: 2x then back down for crisp anti-aliasing on diagonals.
  const artifact = await sharp(trimmed)
    .resize(finalW * 2, finalH * 2, { fit: 'fill' })
    .resize({ width: finalW, height: finalH })
    .png()
    .toBuffer();

  const shadow = await sharp(shadowFrameSvg(finalW, finalH)).png().toBuffer();

  // Position the shot column at the right of the canvas. The shadow
  // wrapper is 24px taller/wider than the artifact (12px on each
  // side), so the actual artifact lands inset by 12.
  const shotLeft = CANVAS_W - finalW - SLOT_RIGHT_MARGIN;
  const shotTop = Math.round((CANVAS_H - finalH) / 2);

  const canvas = await sharp(backdropSvg(caption))
    .composite([
      { input: shadow, left: shotLeft - 12, top: shotTop - 12 },
      { input: artifact, left: shotLeft, top: shotTop },
    ])
    .resize(CANVAS_W, CANVAS_H)
    .png()
    .toBuffer();

  const outPath = resolve(outDir, `${outputName}.png`);
  await writeFile(outPath, canvas);
  console.log(`✓ ${outputName.padEnd(14)} → store/screenshots/${outputName}.png (${CANVAS_W}×${CANVAS_H})`);
  console.log(`  source: ${basename(inputPath)} (trimmed ${tw}×${th} → ${finalW}×${finalH})`);
}

main().catch((err) => {
  console.error('compose-screenshots failed:', err);
  process.exit(1);
});
