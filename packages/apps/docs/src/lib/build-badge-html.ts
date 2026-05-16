// Pure renderer for the embeddable a14y score-card. The same string
// powers the live preview on /badge/ and the snippet shown in the copy
// textarea, so what the user sees is exactly what they paste.
//
// Constraints (from the issue):
//   1. Self-contained — only inline styles + inline SVG, no external assets.
//   2. Match the docs design language (palette below mirrors global.css).
//   3. Theme-aware (light / dark / auto via prefers-color-scheme).

import type { BadgeData } from '@a14y/core';
import {
  BADGE_DARK_PALETTE,
  BADGE_LIGHT_PALETTE,
  FONT_STACK,
  MONO_STACK,
  bandColor,
  logoSvg,
  type BadgePalette,
} from './badge-style';

export { BADGE_DARK_PALETTE, BADGE_LIGHT_PALETTE, type BadgePalette };

export interface BuildBadgeOptions {
  /**
   * Wrap the card in an `<a>` (default) or a `<div>`. Use `'div'` when
   * the badge is rendered on a page where the anchor would self-link
   * (e.g. the hero on a14y.dev itself) — emitting a non-interactive
   * wrapper keeps hover affordances honest.
   */
  renderAs?: 'a' | 'div';
}

export function buildBadgeHtml(
  data: BadgeData,
  options: BuildBadgeOptions = {},
): string {
  const palette = data.theme === 'dark' ? BADGE_DARK_PALETTE : BADGE_LIGHT_PALETTE;
  const id = stableId(data);
  const cls = `a14y-badge-${id}`;

  const host = data.url ? hostOf(data.url) : '';
  const dateText = formatDate(data.date);
  const versionText = data.scorecardVersion ? `V${data.scorecardVersion}` : '';
  const scoreColor = bandColor(data.score, palette);

  const segments = barSegments(data, palette);

  return renderCard({
    cls,
    palette,
    scoreColor,
    versionText,
    dateText,
    host,
    score: data.score,
    applicable: data.applicable,
    total: data.total,
    passed: data.passed,
    failed: data.failed,
    warned: data.warned,
    na: data.na,
    segments,
    renderAs: options.renderAs ?? 'a',
  });
}

interface RenderArgs {
  cls: string;
  palette: BadgePalette;
  scoreColor: string;
  versionText: string;
  dateText: string;
  host: string;
  score: number;
  applicable: number;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  na: number;
  segments: { color: string; pct: number }[];
  renderAs: 'a' | 'div';
}

function renderCard(a: RenderArgs): string {
  const p = a.palette;

  const outerStyle =
    `display:block;text-decoration:none;color:${p.text};` +
    `background:${p.bg};border:1px solid ${p.border};border-radius:14px;` +
    `padding:22px 24px 20px;max-width:520px;width:100%;box-sizing:border-box;` +
    `font-family:${FONT_STACK};line-height:1.4;`;

  const headerStyle =
    `display:flex;justify-content:space-between;align-items:center;` +
    `font-family:${MONO_STACK};font-size:11px;letter-spacing:.12em;text-transform:uppercase;` +
    `color:${p.textSubtle};padding-bottom:14px;border-bottom:1px dashed ${p.border};margin-bottom:18px;`;

  const heroStyle = `display:flex;align-items:center;gap:22px;`;
  const circleStyle =
    `flex:0 0 132px;width:132px;height:132px;border-radius:50%;` +
    `border:1.5px solid ${p.border};display:flex;flex-direction:column;` +
    `align-items:center;justify-content:center;text-align:center;background:${p.surface};`;

  const heroColStyle = `flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;`;

  const wordmarkRowStyle = `display:flex;align-items:center;gap:8px;color:${p.brand};`;
  const wordmarkStyle =
    `font-family:${FONT_STACK};font-size:24px;font-weight:600;letter-spacing:-0.01em;color:${p.brand};line-height:1;`;
  const hostStyle = `color:${p.textMuted};font-size:13px;line-height:1.3;`;

  const barStyle =
    `display:flex;width:100%;height:12px;border-radius:999px;overflow:hidden;` +
    `background:${p.surfaceAlt};margin-top:6px;`;
  const segHtml = a.segments
    .map(
      (s) =>
        `<span style="display:block;height:100%;width:${s.pct.toFixed(2)}%;background:${s.color};"></span>`,
    )
    .join('');

  const captionStyle =
    `font-family:${MONO_STACK};font-size:11px;letter-spacing:.10em;text-transform:uppercase;color:${p.textMuted};margin-top:4px;`;

  const statsRowStyle =
    `display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0 16px;`;

  const stats: Array<{ count: number; label: string; color: string }> = [
    { count: a.passed, label: 'PASSED', color: p.statusPass },
    { count: a.failed, label: 'FAILED', color: p.statusFail },
    { count: a.warned, label: 'WARNED', color: p.statusWarn },
    { count: a.na, label: 'N/A', color: p.statusNa },
  ];
  const statsHtml = stats
    .map(
      (s) =>
        `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">` +
        `<div style="display:flex;align-items:center;gap:6px;color:${p.text};font-size:18px;font-weight:600;">` +
        `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${s.color};"></span>` +
        `<span>${s.count}</span>` +
        `</div>` +
        `<div style="font-family:${MONO_STACK};font-size:10px;letter-spacing:.10em;color:${p.textSubtle};">${s.label}</div>` +
        `</div>`,
    )
    .join('');

  // No nested-card background and no eyebrow — a top divider separates the
  // footer from the stats row, and the line speaks for itself.
  const tryStyle =
    `border-top:1px solid ${p.border};padding:14px 0 0;margin-top:4px;` +
    `font-family:${MONO_STACK};font-size:11px;line-height:1.5;color:${p.textMuted};`;

  // In the A14Y_BASELINE build, the badge must not link out to the
  // real (enhanced) site — that would let an agent crawling the
  // benchmark target fall through to a14y.dev and contaminate the
  // before/after measurement. The badge still renders as an <a> so
  // the visual styling is unchanged; only the href is neutralized.
  const isBaseline =
    typeof process !== 'undefined' && process.env?.A14Y_BASELINE === '1';
  const badgeHref = isBaseline ? '#' : 'https://a14y.dev';
  const wrapperOpen =
    a.renderAs === 'div'
      ? `<div class="a14y-badge ${a.cls}" style="${outerStyle}">`
      : `<a class="a14y-badge ${a.cls}" href="${badgeHref}" target="_blank" rel="noopener" style="${outerStyle}">`;
  const wrapperClose = a.renderAs === 'div' ? `</div>` : `</a>`;

  return (
    wrapperOpen +
    `<div class="${a.cls}__header" style="${headerStyle}">` +
    `<span>A14Y${a.versionText ? ' · ' + a.versionText : ''}</span>` +
    `<span>${a.dateText}</span>` +
    `</div>` +
    `<div class="${a.cls}__hero" style="${heroStyle}">` +
    `<div class="${a.cls}__circle" style="${circleStyle}">` +
    `<div style="font-family:${MONO_STACK};font-size:10px;letter-spacing:.18em;color:${p.textSubtle};">SCORE</div>` +
    `<div class="${a.cls}__score" style="font-size:54px;font-weight:600;line-height:1.05;color:${a.scoreColor};letter-spacing:-0.02em;">${a.score}</div>` +
    `<div style="font-family:${MONO_STACK};font-size:11px;color:${p.textMuted};letter-spacing:.05em;">/100</div>` +
    `</div>` +
    `<div class="${a.cls}__col" style="${heroColStyle}">` +
    `<div style="${wordmarkRowStyle}"><span class="${a.cls}__logo" style="display:inline-flex;color:${p.brand};">${logoSvg(p.surface)}</span><span class="${a.cls}__wordmark" style="${wordmarkStyle}">a14y</span></div>` +
    (a.host ? `<div class="${a.cls}__host" style="${hostStyle}">${escapeText(a.host)}</div>` : '') +
    `<div class="${a.cls}__bar" style="${barStyle}">${segHtml}</div>` +
    `<div class="${a.cls}__caption" style="${captionStyle}">${a.applicable} APPLICABLE · ${a.total} TOTAL</div>` +
    `</div>` +
    `</div>` +
    `<div class="${a.cls}__stats" style="${statsRowStyle}">${statsHtml}</div>` +
    `<div class="${a.cls}__tryit" style="${tryStyle}">` +
    `Try a14y on your own site: https://a14y.dev` +
    `</div>` +
    wrapperClose
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const year = m[1];
  const month = MONTH_NAMES[Number(m[2]) - 1] ?? m[2];
  const day = String(Number(m[3])); // strip leading zero, e.g. "05" -> "5"
  return `${month} ${day}, ${year}`;
}

function barSegments(data: BadgeData, p: BadgePalette): { color: string; pct: number }[] {
  // Bar mirrors the four-column stats row: passed / failed / warned / na.
  // `errored` is rare in practice and intentionally excluded (the score
  // formula already penalizes it; we just don't visualize it separately).
  const denom = Math.max(data.total, 1);
  const raw = [
    { color: p.statusPass, count: data.passed },
    { color: p.statusFail, count: data.failed },
    { color: p.statusWarn, count: data.warned },
    { color: p.statusNa, count: data.na },
  ];
  return raw
    .filter((s) => s.count > 0)
    .map((s) => ({ color: s.color, pct: (s.count / denom) * 100 }));
}

// Deterministic non-cryptographic id so the same data always emits the
// same class names — useful when diffing the snippet.
function stableId(d: BadgeData): string {
  const seed = `${d.score}|${d.date}|${d.url ?? ''}|${d.scorecardVersion}|${d.theme}`;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
