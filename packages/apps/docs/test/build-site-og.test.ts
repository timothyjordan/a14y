import { describe, expect, it } from 'vitest';
import type { BadgeData } from '@a14y/core';
import {
  renderBadgeOgHtml,
  OG_WIDTH,
  OG_HEIGHT,
} from '../src/lib/build-site-og';

const baseData: BadgeData = {
  score: 87,
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
  url: 'https://posthog.com',
  theme: 'light',
};

describe('renderBadgeOgHtml', () => {
  it('returns a standalone HTML document', () => {
    const html = renderBadgeOgHtml(baseData);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('sizes the canvas to 1200x630', () => {
    const html = renderBadgeOgHtml(baseData);
    expect(html).toContain(`width: ${OG_WIDTH}px`);
    expect(html).toContain(`height: ${OG_HEIGHT}px`);
    expect(OG_WIDTH).toBe(1200);
    expect(OG_HEIGHT).toBe(630);
  });

  it('scales the badge up so it fills the canvas legibly', () => {
    const html = renderBadgeOgHtml(baseData);
    // Exact factor may change to fit canvas height; just assert that
    // we're scaling up via the wrapper.
    expect(html).toMatch(/transform:\s*scale\(\s*1?\.\d+\s*\)/);
    expect(html).toContain('class="a14y-og-scale"');
  });

  it('embeds the live badge HTML (score, host, version, date)', () => {
    const html = renderBadgeOgHtml(baseData);
    expect(html).toContain('>87<');
    expect(html).toContain('posthog.com');
    expect(html).toContain('V0.2.0');
    expect(html).toMatch(/APR\s+30,\s+2026/);
    expect(html).toContain('a14y');
  });

  it('preloads the site web fonts', () => {
    const html = renderBadgeOgHtml(baseData);
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('Atkinson+Hyperlegible+Next');
    expect(html).toContain('JetBrains+Mono');
  });

  it('renders the badge as a div, not an anchor', () => {
    // Critical: an <a> wrapper would change the badge layout and would
    // also be semantically wrong on a screenshot canvas.
    const html = renderBadgeOgHtml(baseData);
    expect(html).not.toMatch(/<a[^>]*class="a14y-badge/);
    expect(html).toMatch(/<div[^>]*class="a14y-badge/);
  });

  it('shifts color band with the score', () => {
    const excellent = renderBadgeOgHtml({ ...baseData, score: 95 });
    const poor = renderBadgeOgHtml({ ...baseData, score: 25 });
    // BADGE_LIGHT_PALETTE.scoreExcellent = #1f7a3d, scorePoor = #a83327
    expect(excellent).toContain('#1f7a3d');
    expect(poor).toContain('#a83327');
  });
});
