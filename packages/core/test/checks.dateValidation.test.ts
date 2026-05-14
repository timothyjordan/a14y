import { describe, expect, it } from 'vitest';
import { makePageCtx, makeSiteCtx } from './_helpers';
import { htmlJsonLdDateModified } from '../src/checks/page/jsonLd';
import { sitemapXmlHasLastmod } from '../src/checks/site/sitemapXml';
import {
  isIso8601DateOrDateTime,
  isW3CDateTime,
} from '../src/checks/_dateValidation';

const BASE = 'https://example.com';

function pageHtmlWithDateModified(value: string | null): string {
  const node =
    value === null
      ? '{"@context":"https://schema.org","@type":"TechArticle"}'
      : `{"@context":"https://schema.org","@type":"TechArticle","dateModified":${JSON.stringify(value)}}`;
  return `<!doctype html><html lang="en"><head><script type="application/ld+json">${node}</script></head><body><h1>x</h1></body></html>`;
}

function pageHtmlWithDateModifieds(values: string[]): string {
  const nodes = values
    .map(
      (v) =>
        `{"@context":"https://schema.org","@type":"TechArticle","dateModified":${JSON.stringify(v)}}`,
    )
    .join(',');
  return `<!doctype html><html lang="en"><head><script type="application/ld+json">[${nodes}]</script></head><body><h1>x</h1></body></html>`;
}

describe('_dateValidation', () => {
  // Strings both validators must accept.
  const validBoth = [
    '2026-04-01',
    '2026-04-01T00:00:00Z',
    '2026-04-01T12:34:56+00:00',
    '2026-04-01T12:34:56-08:00',
    '2026-04-01T12:34:56.789Z',
    '  2026-04-01  ', // pretty-printed XML padding
  ];
  // Strings both validators must reject.
  const invalidBoth = [
    '',
    'yesterday',
    '2026', // year-only — deliberately narrowed (see file-level comment)
    '2026-04', // year-month — deliberately narrowed
    '2026-04-01T12:34Z', // seconds-required narrowing
    '2026-13-01',
    '2026-02-30',
    '2026/04/01',
    '04-01-2026',
    '2026-04-01 12:34:56',
    '2026-04-01T12:34:56', // missing TZD
    '2026-04-01T25:00:00Z', // hours > 23
    '2026-04-01T12:60:00Z', // minutes > 59
    '2026-04-01T12:00:60Z', // seconds > 59
    '2026-04-01T12:00:00+99:00', // offset hours > 14
    '2026-04-01T12:00:00+05:60', // offset minutes > 59
    '2026-04-01T12:00:00+14:30', // offset > 14:00 cap
    '2026-04-01T12:00:00+05', // hours-only TZD (deliberately narrowed)
  ];
  // Where the validators legitimately diverge: ISO 8601 permits a
  // no-colon TZD, W3C Datetime requires the colon form.
  const iso8601Only = ['2026-04-01T12:34:56+0000', '2026-04-01T12:34:56-0500'];

  it.each(validBoth)('isIso8601DateOrDateTime accepts %s', (s) => {
    expect(isIso8601DateOrDateTime(s)).toBe(true);
  });
  it.each(invalidBoth)('isIso8601DateOrDateTime rejects %s', (s) => {
    expect(isIso8601DateOrDateTime(s)).toBe(false);
  });
  it.each(iso8601Only)('isIso8601DateOrDateTime accepts no-colon TZD %s', (s) => {
    expect(isIso8601DateOrDateTime(s)).toBe(true);
  });

  it.each(validBoth)('isW3CDateTime accepts %s', (s) => {
    expect(isW3CDateTime(s)).toBe(true);
  });
  it.each(invalidBoth)('isW3CDateTime rejects %s', (s) => {
    expect(isW3CDateTime(s)).toBe(false);
  });
  it.each(iso8601Only)('isW3CDateTime rejects no-colon TZD %s', (s) => {
    expect(isW3CDateTime(s)).toBe(false);
  });

  // Equivalence check on the curated shared corpus: the two validators
  // must agree on every string in `validBoth` and `invalidBoth`. The
  // `iso8601Only` corpus is the documented divergence point.
  it.each([...validBoth, ...invalidBoth])('validators agree on %s', (s) => {
    expect(isIso8601DateOrDateTime(s)).toBe(isW3CDateTime(s));
  });
});

describe('html.json-ld.date-modified 1.1.0', () => {
  const impl = htmlJsonLdDateModified.implementations['1.1.0'];

  it('passes when dateModified is a valid ISO date', async () => {
    const ctx = makePageCtx(BASE, `${BASE}/p`, pageHtmlWithDateModified('2026-04-01'));
    const r = await impl.run(ctx);
    expect(r.status).toBe('pass');
    expect(r.message).toBe('2026-04-01');
  });

  it('passes when dateModified is a valid date-time', async () => {
    const ctx = makePageCtx(
      BASE,
      `${BASE}/p`,
      pageHtmlWithDateModified('2026-04-01T12:34:56Z'),
    );
    expect((await impl.run(ctx)).status).toBe('pass');
  });

  it('passes on ISO 8601 no-colon TZD (schema.org defers to ISO 8601)', async () => {
    const ctx = makePageCtx(
      BASE,
      `${BASE}/p`,
      pageHtmlWithDateModified('2026-04-01T12:34:56+0000'),
    );
    expect((await impl.run(ctx)).status).toBe('pass');
  });

  it('fails when dateModified is missing entirely', async () => {
    const ctx = makePageCtx(BASE, `${BASE}/p`, pageHtmlWithDateModified(null));
    const r = await impl.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.message).toMatch(/no dateModified/);
  });

  it('fails when dateModified is present but not a valid date', async () => {
    const ctx = makePageCtx(BASE, `${BASE}/p`, pageHtmlWithDateModified('yesterday'));
    const r = await impl.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.message).toMatch(/not a valid/);
  });

  it('reports count and example when multiple invalid values are present', async () => {
    const ctx = makePageCtx(
      BASE,
      `${BASE}/p`,
      pageHtmlWithDateModifieds(['yesterday', 'not-a-date', '2026-02-30']),
    );
    const r = await impl.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.message).toMatch(/^3 dateModified value\(s\) present but not a valid/);
    expect(r.message).toContain('yesterday');
  });

  it('fails on calendar-impossible dates', async () => {
    const ctx = makePageCtx(BASE, `${BASE}/p`, pageHtmlWithDateModified('2026-02-30'));
    expect((await impl.run(ctx)).status).toBe('fail');
  });

  it('returns na when there is no JSON-LD on the page', async () => {
    const ctx = makePageCtx(BASE, `${BASE}/p`, '<html lang="en"><body></body></html>');
    expect((await impl.run(ctx)).status).toBe('na');
  });
});

describe('sitemap-xml.has-lastmod 1.1.0', () => {
  const impl = sitemapXmlHasLastmod.implementations['1.1.0'];

  it('passes when every entry has a valid W3C Datetime lastmod', async () => {
    const body = `<?xml version="1.0"?><urlset>
      <url><loc>${BASE}/a</loc><lastmod>2026-01-01</lastmod></url>
      <url><loc>${BASE}/b</loc><lastmod>2026-01-02T12:00:00Z</lastmod></url>
    </urlset>`;
    const ctx = makeSiteCtx(BASE, { [`${BASE}/sitemap.xml`]: { body } });
    const r = await impl.run(ctx);
    expect(r.status).toBe('pass');
    expect(r.message).toContain('2 entries');
  });

  it('passes when pretty-printed <lastmod> has surrounding whitespace', async () => {
    const body = `<?xml version="1.0"?><urlset>
      <url>
        <loc>${BASE}/a</loc>
        <lastmod>
          2026-04-01
        </lastmod>
      </url>
    </urlset>`;
    const ctx = makeSiteCtx(BASE, { [`${BASE}/sitemap.xml`]: { body } });
    const r = await impl.run(ctx);
    expect(r.status).toBe('pass');
  });

  it('fails (not "missing") on year-only <lastmod>2026</lastmod>', async () => {
    // Without parseTagValue: false the parser coerces "2026" to the
    // number 2026, the typeof === 'string' filter routes it into the
    // "missing" bucket, and the failure message reads "1 missing
    // <lastmod>" — a lie. With the parser fix it stays a string and
    // fails as an invalid date.
    const body = `<?xml version="1.0"?><urlset>
      <url><loc>${BASE}/a</loc><lastmod>2026</lastmod></url>
    </urlset>`;
    const ctx = makeSiteCtx(BASE, { [`${BASE}/sitemap.xml`]: { body } });
    const r = await impl.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.message).toMatch(/invalid date/);
    expect(r.message).not.toMatch(/missing/);
  });

  it('fails when an entry has an invalid lastmod', async () => {
    const body = `<?xml version="1.0"?><urlset>
      <url><loc>${BASE}/a</loc><lastmod>2026-01-01</lastmod></url>
      <url><loc>${BASE}/b</loc><lastmod>not-a-date</lastmod></url>
    </urlset>`;
    const ctx = makeSiteCtx(BASE, { [`${BASE}/sitemap.xml`]: { body } });
    const r = await impl.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.message).toMatch(/invalid date/);
  });

  it('fails when entries are missing lastmod', async () => {
    const body = `<?xml version="1.0"?><urlset>
      <url><loc>${BASE}/a</loc></url>
    </urlset>`;
    const ctx = makeSiteCtx(BASE, { [`${BASE}/sitemap.xml`]: { body } });
    const r = await impl.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.message).toMatch(/missing/);
  });

  it('reports both missing and invalid in the same sitemap', async () => {
    const body = `<?xml version="1.0"?><urlset>
      <url><loc>${BASE}/a</loc><lastmod>not-a-date</lastmod></url>
      <url><loc>${BASE}/b</loc></url>
      <url><loc>${BASE}/c</loc><lastmod>2026-01-01</lastmod></url>
    </urlset>`;
    const ctx = makeSiteCtx(BASE, { [`${BASE}/sitemap.xml`]: { body } });
    const r = await impl.run(ctx);
    expect(r.status).toBe('fail');
    expect(r.message).toMatch(/missing/);
    expect(r.message).toMatch(/invalid/);
  });
});
