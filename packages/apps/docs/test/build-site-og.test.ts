import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  renderSiteOgPng,
  renderSiteOgSvg,
  type RenderSiteOgInput,
} from '../src/lib/build-site-og';

const baseInput: RenderSiteOgInput = {
  siteName: 'PostHog',
  hostLabel: 'posthog.com',
  score: 87,
  scorecardVersion: '0.2.0',
  scannedAt: '2026-04-30',
  mode: 'site',
  summary: {
    passed: 32,
    failed: 3,
    warned: 0,
    na: 3,
    total: 38,
    applicable: 35,
  },
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('renderSiteOgPng', () => {
  it('renders a 1200×630 PNG buffer', async () => {
    const buf = await renderSiteOgPng(baseInput);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });

  it.each([
    ['excellent', 92],
    ['good', 78],
    ['fair', 62],
    ['poor', 31],
  ] as const)('renders score band %s (%i) without throwing', async (_band, score) => {
    const buf = await renderSiteOgPng({ ...baseInput, score });
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  });

  it('handles edge scores 0 and 100', async () => {
    const zero = await renderSiteOgPng({ ...baseInput, score: 0 });
    const hundred = await renderSiteOgPng({ ...baseInput, score: 100 });
    expect(zero.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(hundred.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  });
});

describe('renderSiteOgSvg', () => {
  it('includes the score, host, scorecard version, and scanned date', () => {
    const svg = renderSiteOgSvg(baseInput);
    expect(svg).toContain('>87<');
    expect(svg).toContain('posthog.com');
    expect(svg).toContain('V0.2.0');
    expect(svg).toMatch(/APR\s+30,\s+2026/);
  });

  it('truncates a long site name with an ellipsis', () => {
    const longName = 'A Very Long Site Name That Will Not Fit In The OG Layout';
    const svg = renderSiteOgSvg({ ...baseInput, siteName: longName });
    expect(svg).toContain('…');
    expect(svg).not.toContain(longName);
  });

  it('renders the page-check mode label when mode is page', () => {
    const svg = renderSiteOgSvg({ ...baseInput, mode: 'page' });
    expect(svg).toContain('PAGE CHECK');
  });

  it('escapes special characters in the site name', () => {
    const svg = renderSiteOgSvg({ ...baseInput, siteName: 'A & B <Co>' });
    expect(svg).toContain('A &amp; B &lt;Co&gt;');
  });
});
