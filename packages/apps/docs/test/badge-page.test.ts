import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const page = readFileSync(
  path.resolve(__dirname, '../src/pages/badge.astro'),
  'utf-8',
);

describe('badge.astro (TJ-423)', () => {
  it('uses BaseLayout', () => {
    expect(page).toMatch(/import\s+BaseLayout\s+from\s+['"]~\/layouts\/BaseLayout\.astro['"]/);
  });

  it('declares an h1 for the page title', () => {
    expect(page).toMatch(/<h1>[\s\S]*?Embed your a14y badge[\s\S]*?<\/h1>/);
  });

  it('has the live preview, embed-code textarea, and copy button', () => {
    expect(page).toMatch(/id="badge-preview"/);
    expect(page).toMatch(/<textarea[^>]*id="embed-code"[^>]*readonly/);
    expect(page).toMatch(/id="copy-embed"[^>]*>[\s\S]*?Copy/);
  });

  it('exposes the two theme radios (light/dark) — auto was removed', () => {
    expect(page).toMatch(/name="badge-theme"[^>]*value="light"/);
    expect(page).toMatch(/name="badge-theme"[^>]*value="dark"/);
    expect(page).not.toMatch(/name="badge-theme"[^>]*value="auto"/);
  });

  it('renders an empty-state explainer for the no-params case (TJ-642 refined copy)', () => {
    expect(page).toMatch(/id="badge-empty"/);
    // First path: CLI flow with the verified flag spelling
    expect(page).toMatch(/npx\s+a14y\s+check\s+yoursite\.com/i);
    // Second path: leaderboard link as the "already scanned" route
    expect(page).toMatch(/\/leaderboard\/`}>leaderboard</);
    // Fallback: extension link kept as a third option
    expect(page).toMatch(/\/chrome-extension\/`}>a14y Chrome extension</);
  });

  it('points new visitors at the embed guide from the lead copy (TJ-642 activation)', () => {
    expect(page).toMatch(/\/badge\/how-to-embed\/`}>Read the embed guide</);
  });

  it('imports the URL parser from @a14y/core and the HTML builder from ~/lib', () => {
    expect(page).toMatch(/import\s*\{[^}]*parseBadgeParams[^}]*\}\s*from\s*['"]@a14y\/core['"]/);
    expect(page).toMatch(/import\s*\{[^}]*buildBadgeHtml[^}]*\}\s*from\s*['"]~\/lib\/build-badge-html['"]/);
  });

  it('wires the copy button to navigator.clipboard', () => {
    expect(page).toMatch(/navigator\.clipboard\.writeText/);
  });
});
