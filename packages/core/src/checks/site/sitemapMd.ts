import { registerCheck } from '../../scorecard/registry';
import type { SiteCheckContext, SiteCheckSpec } from '../../scorecard/types';
import { wellKnownCandidates } from './_wellKnown';
import { looksLikeHtml } from './_contentType';

const SHARED_KEY = 'site:sitemap-md';

const PATHS = ['/sitemap.md', '/docs/sitemap.md', '/.well-known/sitemap.md'];

export interface SitemapMdResource {
  found: boolean;
  url?: string;
  body?: string;
  contentType?: string;
  headingCount?: number;
  linkCount?: number;
}

export async function loadSitemapMd(ctx: SiteCheckContext): Promise<SitemapMdResource> {
  const cached = ctx.shared.get(SHARED_KEY) as SitemapMdResource | undefined;
  if (cached) return cached;

  let result: SitemapMdResource = { found: false };
  for (const url of wellKnownCandidates(ctx, PATHS)) {
    try {
      const resp = await ctx.http.fetch(url);
      if (resp.status >= 200 && resp.status < 300) {
        const headings = (resp.body.match(/^#+\s/gm) ?? []).length;
        const links = (resp.body.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
        result = {
          found: true,
          url: resp.url,
          body: resp.body,
          contentType: resp.headers.get('content-type') ?? undefined,
          headingCount: headings,
          linkCount: links,
        };
        break;
      }
    } catch {
      // try next
    }
  }
  ctx.shared.set(SHARED_KEY, result);
  return result;
}

export const sitemapMdExists: SiteCheckSpec = {
  id: 'sitemap-md.exists',
  scope: 'site',
  name: 'sitemap.md is published',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if /sitemap.md, /docs/sitemap.md, or /.well-known/sitemap.md returns a 2xx response.',
      run: async (ctx) => {
        const r = await loadSitemapMd(ctx as SiteCheckContext);
        return r.found
          ? { status: 'pass', message: r.url }
          : { status: 'fail', message: 'sitemap.md not reachable' };
      },
    },
    '1.1.0': {
      version: '1.1.0',
      description:
        'Pass if /sitemap.md, /docs/sitemap.md, or /.well-known/sitemap.md returns a 2xx response that is not an HTML page (a soft-200 SPA shell or styled 404 does not count).',
      run: async (ctx) => {
        const r = await loadSitemapMd(ctx as SiteCheckContext);
        if (!r.found) return { status: 'fail', message: 'sitemap.md not reachable' };
        if (looksLikeHtml(r.body ?? '', r.contentType)) {
          return {
            status: 'fail',
            message: `${r.url} returned an HTML page, not a sitemap.md file`,
          };
        }
        return { status: 'pass', message: r.url };
      },
    },
  },
};

export const sitemapMdHasStructure: SiteCheckSpec = {
  id: 'sitemap-md.has-structure',
  scope: 'site',
  name: 'sitemap.md has headings and links',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if sitemap.md contains at least one heading and one link.',
      run: async (ctx) => {
        const r = await loadSitemapMd(ctx as SiteCheckContext);
        if (!r.found) return { status: 'na', message: 'sitemap.md not present' };
        const ok = (r.headingCount ?? 0) > 0 && (r.linkCount ?? 0) > 0;
        return ok
          ? { status: 'pass', message: `${r.headingCount} headings, ${r.linkCount} links` }
          : { status: 'fail', message: 'sitemap.md is missing headings or links' };
      },
    },
  },
};

registerCheck(sitemapMdExists);
registerCheck(sitemapMdHasStructure);
