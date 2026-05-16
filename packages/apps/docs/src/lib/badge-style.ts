// Shared visual tokens for the embeddable a14y badge and the per-site
// OG image. Both renderers must produce the same palette + typography
// so a shared `/badge` and `/leaderboard/<slug>/og.png` feel like one
// design system. Resolved hex/rgb fallbacks for the OKLCH values in
// packages/apps/docs/src/styles/global.css — adjust both in lockstep
// if the tokens move.

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

export const FONT_STACK =
  "'Atkinson Hyperlegible Next','Atkinson Hyperlegible',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
export const MONO_STACK =
  "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// Logo mark traced from packages/apps/docs/public/brand/logo-mark.svg.
// Strokes use `currentColor` so the wordmark color (palette.brand) themes
// every stroke automatically. The magnifying-glass disc is parameterized
// so dark mode can swap from "paper" to "ink".
export function logoSvg(discFill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 422.61 309.61" width="32" height="22" aria-hidden="true" focusable="false" style="display:inline-block;vertical-align:middle"><g fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="10"><line x1="150.5" y1="25.5" x2="25.5" y2="75.5"/><line x1="275.5" y1="75.5" x2="150.5" y2="25.5"/><line x1="275.5" y1="223" x2="275.5" y2="75.5"/><line x1="150.5" y1="275.5" x2="275.5" y2="223"/><line x1="25.5" y1="225.5" x2="148.08" y2="275.5"/><line x1="25.5" y1="75.5" x2="25.5" y2="225.5"/><line x1="275.5" y1="75.5" x2="25.5" y2="225.5"/><line x1="25.5" y1="75.5" x2="275.5" y2="223"/><line x1="150.5" y1="25.5" x2="150.5" y2="275.5"/><line x1="25.5" y1="75.5" x2="275.5" y2="75.5"/><line x1="25.5" y1="225.5" x2="275.5" y2="225.5"/></g><g fill="currentColor" stroke="currentColor" stroke-miterlimit="10"><circle cx="25.5" cy="75.5" r="25"/><circle cx="150.5" cy="275.5" r="25"/><circle cx="275.5" cy="225.5" r="25"/><circle cx="25.5" cy="225.5" r="25"/><circle cx="275.5" cy="75.5" r="25"/><circle cx="150.5" cy="25.5" r="25"/><circle cx="150.5" cy="150.5" r="25"/></g><circle cx="262.5" cy="150.5" r="112.5" fill="${discFill}" fill-opacity="0.9"/><circle cx="262.75" cy="150.5" r="112.5" fill="none" stroke="currentColor" stroke-width="10" stroke-miterlimit="10"/><line x1="375.5" y1="262.5" x2="342.48" y2="229.41" fill="none" stroke="currentColor" stroke-width="10" stroke-miterlimit="10"/><line x1="356.79" y1="243.79" x2="414.48" y2="301.48" fill="none" stroke="currentColor" stroke-width="23" stroke-miterlimit="10"/><g fill="none" stroke="currentColor" stroke-width="20" stroke-miterlimit="10"><line x1="200.5" y1="90.5" x2="325.5" y2="90.5"/><line x1="200.5" y1="130.45" x2="325.5" y2="130.45"/><line x1="200.5" y1="170.43" x2="325.5" y2="170.43"/><line x1="200.5" y1="210.49" x2="325.5" y2="210.49"/></g></svg>`;
}

export function bandColor(score: number, p: BadgePalette): string {
  if (score >= 85) return p.scoreExcellent;
  if (score >= 70) return p.scoreGood;
  if (score >= 50) return p.scoreFair;
  return p.scorePoor;
}
