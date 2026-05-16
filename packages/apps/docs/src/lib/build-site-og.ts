// Renders the per-site Open Graph image served at
// `/leaderboard/<slug>/og.png`. The visual mirrors the embeddable badge
// (`build-badge-html.ts`) so socially-shared scorecards feel like one
// design system: header strip with `A14Y vX.Y.Z` + date, large circular
// score dial, `a14y` wordmark + audited host, horizontal four-segment
// status bar, four-up stat counts, and a footer call-to-action.
//
// Light theme only — social previews ignore prefers-color-scheme.

import sharp from 'sharp';
import {
  BADGE_LIGHT_PALETTE,
  FONT_STACK,
  MONO_STACK,
  bandColor,
  logoSvg,
  type BadgePalette,
} from './badge-style';

export interface RenderSiteOgInput {
  siteName: string;
  hostLabel: string;
  score: number;
  scorecardVersion: string;
  scannedAt: string;
  mode: 'site' | 'page';
  summary: {
    passed: number;
    failed: number;
    warned: number;
    na: number;
    total: number;
    applicable: number;
  };
}

const W = 1200;
const H = 630;

export async function renderSiteOgPng(input: RenderSiteOgInput): Promise<Buffer> {
  const svg = renderSiteOgSvg(input);
  return sharp(Buffer.from(svg), { density: 200 })
    .resize(W, H, { fit: 'fill' })
    .png()
    .toBuffer();
}

export function renderSiteOgSvg(input: RenderSiteOgInput): string {
  const p = BADGE_LIGHT_PALETTE;
  const scoreColor = bandColor(input.score, p);
  const dateText = formatDate(input.scannedAt);
  const versionText = `V${input.scorecardVersion}`;
  const siteName = truncate(input.siteName, 28);
  const hostLabel = truncate(input.hostLabel, 42);
  const modeLabel = input.mode === 'site' ? 'SITE SCAN' : 'PAGE CHECK';
  const segments = barSegments(input.summary, p);

  const headerY = 70;
  const cardX = 64;
  const cardY = 110;
  const cardW = W - cardX * 2;
  const cardH = 410;
  const cardR = 22;

  const dialCx = cardX + 170;
  const dialCy = cardY + cardH / 2;
  const dialR = 142;

  const heroX = dialCx + dialR + 56;
  const heroTop = cardY + 64;

  const barX = heroX;
  const barY = heroTop + 110;
  const barW = cardX + cardW - barX - 48;
  const barH = 22;

  // Stats sit on the right (aligned with the bar/caption), not full-width.
  // A full-width row at this size would crash into the score dial on the
  // left and read as overlap in social thumbnails.
  const statsRowY = cardY + cardH - 72;
  const stats: Array<{ count: number; label: string; color: string }> = [
    { count: input.summary.passed, label: 'PASSED', color: p.statusPass },
    { count: input.summary.failed, label: 'FAILED', color: p.statusFail },
    { count: input.summary.warned, label: 'WARNED', color: p.statusWarn },
    { count: input.summary.na, label: 'N/A', color: p.statusNa },
  ];
  const statColW = barW / 4;

  const footerY = cardY + cardH + 56;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${p.bg}"/>

  <!-- top header strip: A14Y · vX.Y.Z … scanned date -->
  <g font-family="${MONO_STACK}" font-size="20" letter-spacing="3" fill="${p.textSubtle}">
    <text x="${cardX}" y="${headerY}">A14Y · ${escapeText(versionText)}</text>
    <text x="${W - cardX}" y="${headerY}" text-anchor="end">${escapeText(dateText)}</text>
  </g>

  <!-- card -->
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="${cardR}" ry="${cardR}"
        fill="${p.surface}" stroke="${p.border}" stroke-width="2"/>

  <!-- score dial -->
  <circle cx="${dialCx}" cy="${dialCy}" r="${dialR}" fill="${p.bg}" stroke="${p.border}" stroke-width="3"/>
  <text x="${dialCx}" y="${dialCy - 70}" text-anchor="middle"
        font-family="${MONO_STACK}" font-size="22" letter-spacing="4" fill="${p.textSubtle}">SCORE</text>
  <text x="${dialCx}" y="${dialCy + 32}" text-anchor="middle"
        font-family="${FONT_STACK}" font-size="148" font-weight="700" letter-spacing="-4"
        fill="${scoreColor}">${input.score}</text>
  <text x="${dialCx}" y="${dialCy + 78}" text-anchor="middle"
        font-family="${MONO_STACK}" font-size="20" letter-spacing="2" fill="${p.textMuted}">/ 100</text>

  <!-- hero column: logo + wordmark, host, bar, caption -->
  <g transform="translate(${heroX}, ${heroTop})" fill="${p.brand}">
    <g transform="translate(0, -28) scale(2.2)">${logoSvg(p.surface)}</g>
    <text x="80" y="0" font-family="${FONT_STACK}" font-size="56" font-weight="700"
          letter-spacing="-2" fill="${p.brand}">a14y</text>
  </g>

  <text x="${heroX}" y="${heroTop + 56}" font-family="${FONT_STACK}" font-size="38" font-weight="600"
        fill="${p.text}" letter-spacing="-0.8">${escapeText(siteName)}</text>
  <text x="${heroX}" y="${heroTop + 92}" font-family="${MONO_STACK}" font-size="22"
        fill="${p.textMuted}" letter-spacing="0.5">${escapeText(hostLabel)}</text>

  <!-- four-segment progress bar -->
  <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${barH / 2}" ry="${barH / 2}"
        fill="${p.surfaceAlt}"/>
  ${renderBarSegments(segments, barX, barY, barW, barH)}

  <!-- caption under the bar -->
  <text x="${barX}" y="${barY + barH + 32}" font-family="${MONO_STACK}" font-size="18"
        letter-spacing="2" fill="${p.textMuted}">
    ${input.summary.applicable} APPLICABLE · ${input.summary.total} TOTAL · ${modeLabel}
  </text>

  <!-- four-up stats row -->
  ${stats
    .map((s, i) => {
      const cx = barX + statColW * (i + 0.5);
      const dotR = 7;
      return `
    <g>
      <circle cx="${cx - 38}" cy="${statsRowY - 14}" r="${dotR}" fill="${s.color}"/>
      <text x="${cx - 24}" y="${statsRowY - 4}" font-family="${FONT_STACK}" font-size="40"
            font-weight="700" fill="${p.text}" text-anchor="start">${s.count}</text>
      <text x="${cx}" y="${statsRowY + 24}" font-family="${MONO_STACK}" font-size="16"
            letter-spacing="2" fill="${p.textSubtle}" text-anchor="middle">${s.label}</text>
    </g>`;
    })
    .join('')}

  <!-- footer: call to action -->
  <text x="${W / 2}" y="${footerY}" text-anchor="middle"
        font-family="${MONO_STACK}" font-size="22" letter-spacing="2" fill="${p.textMuted}">
    TRY A14Y ON YOUR OWN SITE  ·  HTTPS://A14Y.DEV
  </text>
</svg>`.trim();
}

function renderBarSegments(
  segments: { color: string; pct: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  let cursor = x;
  return segments
    .map((s) => {
      const segW = (s.pct / 100) * w;
      const rect = `<rect x="${cursor}" y="${y}" width="${segW}" height="${h}" fill="${s.color}"/>`;
      cursor += segW;
      return rect;
    })
    .join('\n  ');
}

function barSegments(
  summary: RenderSiteOgInput['summary'],
  p: BadgePalette,
): { color: string; pct: number }[] {
  const denom = Math.max(summary.total, 1);
  return [
    { color: p.statusPass, count: summary.passed },
    { color: p.statusFail, count: summary.failed },
    { color: p.statusWarn, count: summary.warned },
    { color: p.statusNa, count: summary.na },
  ]
    .filter((s) => s.count > 0)
    .map((s) => ({ color: s.color, pct: (s.count / denom) * 100 }));
}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const year = m[1];
  const month = MONTH_NAMES[Number(m[2]) - 1] ?? m[2];
  const day = String(Number(m[3]));
  return `${month} ${day}, ${year}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
