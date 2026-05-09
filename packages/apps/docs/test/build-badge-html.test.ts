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

  it('renders all five status counts with their labels', () => {
    const html = buildBadgeHtml(data);
    expect(html).toMatch(/>32<[^]*?PASSED/);
    expect(html).toMatch(/>3<[^]*?FAILED/);
    expect(html).toMatch(/>0<[^]*?WARNED/);
    expect(html).toMatch(/>0<[^]*?ERRORED/);
    expect(html).toMatch(/>3<[^]*?N\/A/);
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

  it('renders a "TRY IT" footer with the npx command including the audited URL', () => {
    const html = buildBadgeHtml(data);
    expect(html).toContain('TRY IT');
    expect(html).toContain('npx a14y https://example.com');
  });

  it('falls back to a generic try-it command when the audited URL is missing', () => {
    const html = buildBadgeHtml({ ...data, url: undefined });
    expect(html).toContain('npx a14y');
    expect(html).not.toContain('npx a14y undefined');
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

  it('emits a scoped <style> block with prefers-color-scheme in auto theme', () => {
    const html = buildBadgeHtml({ ...data, theme: 'auto' });
    expect(html).toContain('<style>');
    expect(html).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
    // Both palettes' background must appear so the @media swap has values.
    expect(html).toContain(BADGE_LIGHT_PALETTE.bg);
    expect(html).toContain(BADGE_DARK_PALETTE.bg);
  });

  it('colors the score number using the band thresholds', () => {
    expect(buildBadgeHtml({ ...data, score: 92 })).toContain(BADGE_LIGHT_PALETTE.scoreExcellent);
    expect(buildBadgeHtml({ ...data, score: 75 })).toContain(BADGE_LIGHT_PALETTE.scoreGood);
    expect(buildBadgeHtml({ ...data, score: 60 })).toContain(BADGE_LIGHT_PALETTE.scoreFair);
    expect(buildBadgeHtml({ ...data, score: 40 })).toContain(BADGE_LIGHT_PALETTE.scorePoor);
  });

  it('shows the letter grade matching the band (A/B/C/D)', () => {
    expect(buildBadgeHtml({ ...data, score: 92 })).toMatch(/\/100\s*·\s*A/);
    expect(buildBadgeHtml({ ...data, score: 75 })).toMatch(/\/100\s*·\s*B/);
    expect(buildBadgeHtml({ ...data, score: 60 })).toMatch(/\/100\s*·\s*C/);
    expect(buildBadgeHtml({ ...data, score: 40 })).toMatch(/\/100\s*·\s*D/);
  });

  it('returns markup safe to embed (single root anchor + optional <style>)', () => {
    const light = buildBadgeHtml({ ...data, theme: 'light' });
    expect(light.trim().startsWith('<a')).toBe(true);
    expect(light.trim().endsWith('</a>')).toBe(true);

    const auto = buildBadgeHtml({ ...data, theme: 'auto' });
    expect(auto.trim().startsWith('<a')).toBe(true);
    expect(auto.trim().endsWith('</style>')).toBe(true);
  });
});
