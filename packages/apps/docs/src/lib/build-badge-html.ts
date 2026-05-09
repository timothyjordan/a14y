// Pure renderer for the embeddable a14y score-card. The same string
// powers the live preview on /badge/ and the snippet shown in the copy
// textarea, so what the user sees is exactly what they paste.
//
// Constraints (from the issue):
//   1. Self-contained — only inline styles + inline SVG, no external assets.
//   2. Match the docs design language (palette below mirrors global.css).
//   3. Theme-aware (light / dark / auto via prefers-color-scheme).

import type { BadgeData } from '@a14y/core';

export interface BadgePalette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  brand: string;
  scoreExcellent: string;
  scoreGood: string;
  scoreFair: string;
  scorePoor: string;
  statusPass: string;
  statusFail: string;
  statusWarn: string;
  statusNa: string;
}

// Resolved hex/rgb fallbacks for the OKLCH values in
// packages/apps/docs/src/styles/global.css. The visual feel must match the
// running site, so adjust both in lockstep if the tokens move.
export const BADGE_LIGHT_PALETTE: BadgePalette = {
  bg: '#faf7ed',
  surface: '#fefdf9',
  surfaceAlt: '#efebde',
  border: '#d8d3c1',
  borderStrong: '#bdb7a3',
  text: '#1d2030',
  textMuted: '#6f718c',
  textSubtle: '#9ea0b3',
  brand: '#1b2763',
  scoreExcellent: '#1f7a3d',
  scoreGood: '#2c6f8a',
  scoreFair: '#a86417',
  scorePoor: '#a83327',
  statusPass: '#1f7a3d',
  statusFail: '#a83327',
  statusWarn: '#a86417',
  statusNa: '#9a958a',
};

export const BADGE_DARK_PALETTE: BadgePalette = {
  bg: '#1a1d2b',
  surface: '#22253a',
  surfaceAlt: '#2a2e44',
  border: '#3b4060',
  borderStrong: '#535880',
  text: '#f3eee2',
  textMuted: '#b6b1a4',
  textSubtle: '#82806f',
  brand: '#f3eee2',
  scoreExcellent: '#5fc17f',
  scoreGood: '#6cb6cf',
  scoreFair: '#d49764',
  scorePoor: '#d97a73',
  statusPass: '#5fc17f',
  statusFail: '#d97a73',
  statusWarn: '#d49764',
  statusNa: '#7a7867',
};

const FONT_STACK =
  "'Atkinson Hyperlegible Next','Atkinson Hyperlegible',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
const MONO_STACK =
  "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// Logo mark traced from packages/apps/docs/public/brand/logo-mark.svg.
// Stroke uses currentColor so we can theme it with the brand color.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 422.61 309.61" width="32" height="22" aria-hidden="true" focusable="false" style="display:inline-block;vertical-align:middle"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="10"><line x1="150.5" y1="25.5" x2="25.5" y2="75.5"/><line x1="275.5" y1="75.5" x2="150.5" y2="25.5"/><line x1="275.5" y1="223" x2="275.5" y2="75.5"/><line x1="150.5" y1="275.5" x2="275.5" y2="223"/><line x1="25.5" y1="225.5" x2="148.08" y2="275.5"/><line x1="25.5" y1="75.5" x2="25.5" y2="225.5"/><line x1="275.5" y1="75.5" x2="25.5" y2="225.5"/><line x1="25.5" y1="75.5" x2="275.5" y2="223"/><line x1="150.5" y1="25.5" x2="150.5" y2="275.5"/><line x1="25.5" y1="75.5" x2="275.5" y2="75.5"/><line x1="25.5" y1="225.5" x2="275.5" y2="225.5"/></g><g fill="currentColor" stroke="currentColor" stroke-miterlimit="10"><circle cx="25.5" cy="75.5" r="25"/><circle cx="150.5" cy="275.5" r="25"/><circle cx="275.5" cy="225.5" r="25"/><circle cx="25.5" cy="225.5" r="25"/><circle cx="275.5" cy="75.5" r="25"/><circle cx="150.5" cy="25.5" r="25"/><circle cx="150.5" cy="150.5" r="25"/></g><circle cx="262.5" cy="150.5" r="112.5" fill="#fff" fill-opacity="0.9"/><circle cx="262.75" cy="150.5" r="112.5" fill="none" stroke="currentColor" stroke-width="10" stroke-miterlimit="10"/><line x1="375.5" y1="262.5" x2="342.48" y2="229.41" fill="none" stroke="currentColor" stroke-width="10" stroke-miterlimit="10"/><line x1="356.79" y1="243.79" x2="414.48" y2="301.48" fill="none" stroke="currentColor" stroke-width="23" stroke-miterlimit="10"/><g fill="none" stroke="currentColor" stroke-width="20" stroke-miterlimit="10"><line x1="200.5" y1="90.5" x2="325.5" y2="90.5"/><line x1="200.5" y1="130.45" x2="325.5" y2="130.45"/><line x1="200.5" y1="170.43" x2="325.5" y2="170.43"/><line x1="200.5" y1="210.49" x2="325.5" y2="210.49"/></g></svg>`;

export function buildBadgeHtml(data: BadgeData): string {
  const isAuto = data.theme === 'auto';
  const palette = data.theme === 'dark' ? BADGE_DARK_PALETTE : BADGE_LIGHT_PALETTE;
  const id = stableId(data);
  const cls = `a14y-badge-${id}`;

  const host = data.url ? hostOf(data.url) : '';
  const dateText = formatDate(data.date);
  const versionText = data.scorecardVersion ? `V${data.scorecardVersion}` : '';
  const scoreColor = bandColor(data.score, palette);

  const segments = barSegments(data, palette);

  const card = renderCard({
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
  });

  if (!isAuto) return card;

  const style = autoThemeCss(cls, BADGE_LIGHT_PALETTE, BADGE_DARK_PALETTE);
  return card + style;
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
}

function renderCard(a: RenderArgs): string {
  const p = a.palette;

  const outerStyle =
    `display:block;text-decoration:none;color:${p.text};` +
    `background:${p.bg};border:1px solid ${p.border};border-radius:14px;` +
    `padding:22px 24px 20px;max-width:520px;width:100%;box-sizing:border-box;` +
    `font-family:${FONT_STACK};line-height:1.4;` +
    `box-shadow:0 1px 0 ${p.border} inset;`;

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

  // No nested-card background — a top divider separates the footer from the
  // stats row instead, keeping the footer as a flat text block.
  const tryStyle =
    `border-top:1px solid ${p.border};padding:14px 0 0;margin-top:4px;` +
    `font-family:${MONO_STACK};font-size:11px;line-height:1.5;color:${p.textMuted};`;
  const tryEyebrow = `font-size:10px;letter-spacing:.12em;color:${p.textSubtle};display:block;margin-bottom:4px;`;

  return (
    `<a class="a14y-badge ${a.cls}" href="https://a14y.dev" target="_blank" rel="noopener" style="${outerStyle}">` +
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
    `<div style="${wordmarkRowStyle}"><span class="${a.cls}__logo" style="display:inline-flex;color:${p.brand};">${LOGO_SVG}</span><span class="${a.cls}__wordmark" style="${wordmarkStyle}">a14y</span></div>` +
    (a.host ? `<div class="${a.cls}__host" style="${hostStyle}">${escapeText(a.host)}</div>` : '') +
    `<div class="${a.cls}__bar" style="${barStyle}">${segHtml}</div>` +
    `<div class="${a.cls}__caption" style="${captionStyle}">${a.applicable} APPLICABLE · ${a.total} TOTAL</div>` +
    `</div>` +
    `</div>` +
    `<div class="${a.cls}__stats" style="${statsRowStyle}">${statsHtml}</div>` +
    `<div class="${a.cls}__tryit" style="${tryStyle}">` +
    `<span style="${tryEyebrow}">TRY IT</span>` +
    `Try a14y on your own site: https://a14y.dev` +
    `</div>` +
    `</a>`
  );
}

function autoThemeCss(
  cls: string,
  light: BadgePalette,
  dark: BadgePalette,
): string {
  // For auto theme we keep the light palette baked into inline styles (so
  // light-mode browsers render correctly without any CSS) and emit a
  // scoped @media (prefers-color-scheme: dark) block that swaps every
  // light token for its dark equivalent via attribute selectors.
  //
  // !important is required because inline styles otherwise outrank
  // selector rules. The selectors are scoped to the unique class so the
  // overrides cannot leak into the host site.
  const root = `.${cls}`;

  // Use Maps so duplicate hex values (e.g. statusPass shares its hex with
  // scoreExcellent) collapse to a single rule.
  const colorSwaps = new Map<string, string>();
  const bgSwaps = new Map<string, string>();
  const borderSwaps = new Map<string, string>();

  const colorTokens: (keyof BadgePalette)[] = [
    'text',
    'textMuted',
    'textSubtle',
    'brand',
    'scoreExcellent',
    'scoreGood',
    'scoreFair',
    'scorePoor',
  ];
  const bgTokens: (keyof BadgePalette)[] = [
    'bg',
    'surface',
    'surfaceAlt',
    'statusPass',
    'statusFail',
    'statusWarn',
    'statusError',
    'statusNa',
  ];
  const borderTokens: (keyof BadgePalette)[] = ['border'];

  for (const t of colorTokens) colorSwaps.set(light[t], dark[t]);
  for (const t of bgTokens) bgSwaps.set(light[t], dark[t]);
  for (const t of borderTokens) borderSwaps.set(light[t], dark[t]);

  const rules: string[] = [];
  for (const [l, d] of colorSwaps) {
    rules.push(
      `${root}[style*="color:${l}"],${root} [style*="color:${l}"]{color:${d} !important;}`,
    );
  }
  for (const [l, d] of bgSwaps) {
    rules.push(
      `${root}[style*="background:${l}"],${root} [style*="background:${l}"]{background:${d} !important;}`,
    );
  }
  for (const [l, d] of borderSwaps) {
    // Inline styles use shorthand `border:1px solid <hex>` and
    // `border-bottom:1px dashed <hex>`. A targeted `border-color:` override
    // covers both shorthand declarations.
    rules.push(
      `${root}[style*="${l}"],${root} [style*="${l}"]{border-color:${d} !important;}`,
    );
  }

  return `<style>@media (prefers-color-scheme: dark){${rules.join('')}}</style>`;
}

function bandColor(score: number, p: BadgePalette): string {
  if (score >= 85) return p.scoreExcellent;
  if (score >= 70) return p.scoreGood;
  if (score >= 50) return p.scoreFair;
  return p.scorePoor;
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
