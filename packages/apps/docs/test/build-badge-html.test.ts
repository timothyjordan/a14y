import { describe, expect, it } from 'vitest';
import {
  buildBadgeHtml,
  BADGE_LIGHT_PALETTE,
  BADGE_DARK_PALETTE,
} from '../src/lib/build-badge-html';
import type { BadgeData } from '@a14y/core';

const data: BadgeData = {
  score: 91,
  scorecardVersion: '0.2.0',
  applicable: 35,
  total: 38,
  passed: 32,
  failed: 3,
  warned: 0,
  errored: 0,
  na: 3,
  date: '2026-04-30',
  mode: 'site',
  url: 'https://example.com',
  theme: 'light',
};

describe('buildBadgeHtml', () => {
  it('includes the score, scorecard version, audited host, and finished date', () => {
    const html = buildBadgeHtml(data);
    expect(html).toContain('>91<');
    expect(html).toContain('example.com');
    expect(html).toContain('V0.2.0');
    expect(html).toMatch(/APR\s+30,\s+2026/);
  });

  it('strips a leading www. from the audited host', () => {
    const html = buildBadgeHtml({ ...data, url: 'https://www.example.com/path?q=1' });
    expect(html).toContain('>example.com<');
    expect(html).not.toMatch(/>www\.example\.com</);
  });

  it('renders four status counts (PASSED, FAILED, WARNED, N/A) with their labels', () => {
    const html = buildBadgeHtml(data);
    expect(html).toMatch(/>32<[^]*?PASSED/);
    expect(html).toMatch(/>3<[^]*?FAILED/);
    expect(html).toMatch(/>0<[^]*?WARNED/);
    expect(html).toMatch(/>3<[^]*?N\/A/);
    // ERRORED is rare in practice and dropped from the badge to keep
    // the stats row at four balanced columns.
    expect(html).not.toMatch(/ERRORED/);
  });

  it('renders the applicable/total caption', () => {
    expect(buildBadgeHtml(data)).toMatch(/35\s+APPLICABLE/);
    expect(buildBadgeHtml(data)).toMatch(/38\s+TOTAL/);
  });

  it('inlines the a14y logo SVG so no external assets are loaded', () => {
    const html = buildBadgeHtml(data);
    expect(html).toMatch(/<svg [^>]*viewBox="0 0 422\.61 309\.61"/);
    expect(html).not.toMatch(/<img\s/);
  });

  it('wraps the badge in an anchor that links to https://a14y.dev', () => {
    expect(buildBadgeHtml(data)).toMatch(/<a [^>]*href="https:\/\/a14y\.dev"[^>]*>/);
  });

  it('renders a stable footer line pointing at https://a14y.dev (no eyebrow, no npx command)', () => {
    const html = buildBadgeHtml(data);
    expect(html).toContain('Try a14y on your own site: https://a14y.dev');
    // The "TRY IT" eyebrow was redundant with the body line. Body alone now.
    expect(html).not.toContain('TRY IT');
    // Per-run npx command + audited URL are gone — the footer is a stable
    // invitation that works for embedders without CLI familiarity.
    expect(html).not.toMatch(/npx\s+a14y/);
    expect(html).not.toContain('https://example.com');
  });

  it('keeps the static footer when the audited URL is missing', () => {
    const html = buildBadgeHtml({ ...data, url: undefined });
    expect(html).toContain('Try a14y on your own site: https://a14y.dev');
  });

  it('uses the light palette and emits no <style> tag in light theme', () => {
    const html = buildBadgeHtml({ ...data, theme: 'light' });
    expect(html).not.toContain('<style');
    expect(html).toContain(BADGE_LIGHT_PALETTE.bg);
  });

  it('uses the dark palette and emits no <style> tag in dark theme', () => {
    const html = buildBadgeHtml({ ...data, theme: 'dark' });
    expect(html).not.toContain('<style');
    expect(html).toContain(BADGE_DARK_PALETTE.bg);
  });

  it('colors the score number using the band thresholds', () => {
    expect(buildBadgeHtml({ ...data, score: 92 })).toContain(BADGE_LIGHT_PALETTE.scoreExcellent);
    expect(buildBadgeHtml({ ...data, score: 75 })).toContain(BADGE_LIGHT_PALETTE.scoreGood);
    expect(buildBadgeHtml({ ...data, score: 60 })).toContain(BADGE_LIGHT_PALETTE.scoreFair);
    expect(buildBadgeHtml({ ...data, score: 40 })).toContain(BADGE_LIGHT_PALETTE.scorePoor);
  });

  it('renders /100 under the score number with no letter grade', () => {
    const html = buildBadgeHtml(data);
    expect(html).toMatch(/\/100/);
    // The letter-grade suffix ("· A" / "· B" / etc.) is gone — the score
    // number plus the band-color already convey level.
    for (const grade of ['A', 'B', 'C', 'D']) {
      expect(html).not.toMatch(new RegExp(`\\/100\\s*·\\s*${grade}\\b`));
    }
  });

  it('returns a single self-contained anchor element regardless of theme', () => {
    for (const theme of ['light', 'dark'] as const) {
      const html = buildBadgeHtml({ ...data, theme });
      expect(html.trim().startsWith('<a')).toBe(true);
      expect(html.trim().endsWith('</a>')).toBe(true);
      expect(html).not.toContain('<style');
    }
  });
});
