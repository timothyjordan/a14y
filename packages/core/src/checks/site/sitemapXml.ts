import { XMLParser } from 'fast-xml-parser';
import { registerCheck } from '../../scorecard/registry';
import type { SiteCheckContext, SiteCheckSpec } from '../../scorecard/types';

const SHARED_KEY = 'site:sitemap-xml';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
}

export interface SitemapXmlResource {
  found: boolean;
  url?: string;
  raw?: string;
  parsed?: boolean;
  isIndex?: boolean;
  /** Flat list of <url><loc> entries (sitemap index entries are followed). */
  entries?: SitemapEntry[];
  /** All loc strings, used by discovery.indexed in the runner. */
  urls?: string[];
}

const parser = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === 'url' || name === 'sitemap',
});

interface ParsedSitemap {
  ok: boolean;
  kind?: 'urlset' | 'sitemapindex';
  entries: SitemapEntry[];
  /** For sitemapindex: child sitemap URLs to follow. */
  childSitemaps: string[];
}

function parseSitemapBody(body: string): ParsedSitemap {
  let xml: unknown;
  try {
    xml = parser.parse(body);
  } catch {
    return { ok: false, entries: [], childSitemaps: [] };
  }
  const root = (xml as { urlset?: unknown; sitemapindex?: unknown }) ?? {};
  if (root.urlset) {
    const urls = ((root.urlset as { url?: Array<{ loc?: string; lastmod?: string }> }).url ?? [])
      .filter((u) => typeof u.loc === 'string')
      .map((u) => ({ loc: u.loc as string, lastmod: u.lastmod }));
    return { ok: true, kind: 'urlset', entries: urls, childSitemaps: [] };
  }
  if (root.sitemapindex) {
    const children = ((root.sitemapindex as { sitemap?: Array<{ loc?: string }> }).sitemap ?? [])
      .map((s) => s.loc)
      .filter((s): s is string => typeof s === 'string');
    return { ok: true, kind: 'sitemapindex', entries: [], childSitemaps: children };
  }
  return { ok: false, entries: [], childSitemaps: [] };
}

async function fetchSitemapAt(ctx: SiteCheckContext, url: string): Promise<SitemapXmlResource> {
  try {
    const resp = await ctx.http.fetch(url);
    if (resp.status < 200 || resp.status >= 300) return { found: false };
    const parsed = parseSitemapBody(resp.body);
    if (!parsed.ok) {
      return { found: true, url: resp.url, raw: resp.body, parsed: false };
    }
    if (parsed.kind === 'urlset') {
      return {
        found: true,
        url: resp.url,
        raw: resp.body,
        parsed: true,
        isIndex: false,
        entries: parsed.entries,
        urls: parsed.entries.map((e) => e.loc),
      };
    }
    // sitemapindex — follow children sequentially. We deliberately don't use
    // the crawler queue here so this loader stays usable from a check that
    // runs without a configured queue.
    const allEntries: SitemapEntry[] = [];
    for (const childUrl of parsed.childSitemaps) {
      try {
        const childResp = await ctx.http.fetch(childUrl);
        if (childResp.status < 200 || childResp.status >= 300) continue;
        const child = parseSitemapBody(childResp.body);
        if (child.ok && child.kind === 'urlset') {
          for (const e of child.entries) allEntries.push(e);
        }
      } catch {
        // skip unreachable child sitemaps
      }
    }
    return {
      found: true,
      url: resp.url,
      raw: resp.body,
      parsed: true,
      isIndex: true,
      entries: allEntries,
      urls: allEntries.map((e) => e.loc),
    };
  } catch {
    return { found: false };
  }
}

export async function loadSitemapXml(ctx: SiteCheckContext): Promise<SitemapXmlResource> {
  const cached = ctx.shared.get(SHARED_KEY) as SitemapXmlResource | undefined;
  if (cached) return cached;

  const candidates = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml'];
  let result: SitemapXmlResource = { found: false };
  for (const path of candidates) {
    const tried = await fetchSitemapAt(ctx, new URL(path, ctx.baseUrl).toString());
    if (tried.found) {
      result = tried;
      break;
    }
  }
  ctx.shared.set(SHARED_KEY, result);
  return result;
}

export const sitemapXmlExists: SiteCheckSpec = {
  id: 'sitemap-xml.exists',
  scope: 'site',
  name: 'sitemap.xml is published',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if /sitemap.xml (or sitemap_index.xml / sitemap-index.xml) returns a 2xx response.',
      run: async (ctx) => {
        const r = await loadSitemapXml(ctx as SiteCheckContext);
        return r.found
          ? { status: 'pass', message: r.url }
          : { status: 'fail', message: 'sitemap.xml not reachable' };
      },
    },
  },
};

export const sitemapXmlValid: SiteCheckSpec = {
  id: 'sitemap-xml.valid',
  scope: 'site',
  name: 'sitemap.xml parses as urlset or sitemapindex',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the sitemap parses as XML and contains <urlset> or <sitemapindex>.',
      run: async (ctx) => {
        const r = await loadSitemapXml(ctx as SiteCheckContext);
        if (!r.found) return { status: 'na', message: 'sitemap.xml not present' };
        return r.parsed
          ? { status: 'pass', message: r.isIndex ? 'sitemapindex' : 'urlset' }
          : { status: 'fail', message: 'sitemap.xml did not parse as urlset/sitemapindex' };
      },
    },
  },
};

export const sitemapXmlHasLastmod: SiteCheckSpec = {
  id: 'sitemap-xml.has-lastmod',
  scope: 'site',
  name: 'sitemap entries include <lastmod>',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if every <url> in sitemap.xml has a <lastmod> child.',
      run: async (ctx) => {
        const r = await loadSitemapXml(ctx as SiteCheckContext);
        if (!r.found || !r.parsed) return { status: 'na', message: 'sitemap.xml unavailable' };
        // For sitemapindex, the loader followed children and merged their
        // <url> entries; we evaluate lastmod against the merged set.
        const entries = r.entries ?? [];
        if (entries.length === 0) {
          return { status: 'warn', message: 'sitemap.xml has no <url> entries' };
        }
        const missing = entries.filter((e) => !e.lastmod).length;
        return missing === 0
          ? { status: 'pass', message: `${entries.length} entries with lastmod` }
          : {
              status: 'fail',
              message: `${missing}/${entries.length} entries missing <lastmod>`,
            };
      },
    },
  },
};

registerCheck(sitemapXmlExists);
registerCheck(sitemapXmlValid);
registerCheck(sitemapXmlHasLastmod);
