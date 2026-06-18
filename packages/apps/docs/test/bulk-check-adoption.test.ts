import { describe, it, expect } from 'vitest';
import { themeForCheck, checkAdoptionPct } from '../src/lib/bulk-data';

describe('check adoption helpers', () => {
  it('maps a check id to its display theme', () => {
    expect(themeForCheck('markdown.mirror-suffix')).toBe('Markdown mirror');
    expect(themeForCheck('robots-txt.allows-ai-bots')).toBe('Discoverability');
    expect(themeForCheck('html.json-ld.breadcrumb')).toBe('Structured data');
    expect(themeForCheck('html.ssr-content')).toBe('Content structure');
    expect(themeForCheck('http.no-interstitial')).toBe('HTTP');
  });
  it('computes share-of-all and share-of-applicable', () => {
    const c = { checkId: 'x', name: 'X', scope: 'page' as const, applicable: 40, passing: 10 };
    expect(checkAdoptionPct(c, 100).ofAll).toBe(10);
    expect(checkAdoptionPct(c, 100).ofApplicable).toBe(25);
  });
});
