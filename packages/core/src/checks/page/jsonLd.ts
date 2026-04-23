import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';
import { htmlOnly } from './_htmlOnly';

const SHARED_KEY_PREFIX = 'page:json-ld:';

interface ParsedJsonLd {
  blocks: unknown[];
  flat: Array<Record<string, unknown>>;
}

/**
 * Parse every JSON-LD <script> on the page exactly once and stash on the
 * page-scoped shared map so the three json-ld.* checks share work.
 */
function parseJsonLd(ctx: PageCheckContext): ParsedJsonLd {
  const cacheKey = SHARED_KEY_PREFIX + ctx.url;
  const cached = ctx.shared.get(cacheKey) as ParsedJsonLd | undefined;
  if (cached) return cached;

  const blocks: unknown[] = [];
  const flat: Array<Record<string, unknown>> = [];
  ctx.page.$('script[type="application/ld+json"]').each((_, el) => {
    const text = ctx.page.$(el).text().trim();
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      blocks.push(parsed);
      flatten(parsed, flat);
    } catch {
      // ignore malformed blocks; html.json-ld will note that none parsed
    }
  });

  const result = { blocks, flat };
  ctx.shared.set(cacheKey, result);
  return result;
}

function flatten(node: unknown, out: Array<Record<string, unknown>>): void {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((n) => flatten(n, out));
    return;
  }
  if (typeof node === 'object') {
    out.push(node as Record<string, unknown>);
    const obj = node as Record<string, unknown>;
    if ('@graph' in obj) flatten(obj['@graph'], out);
  }
}

function nodeType(n: Record<string, unknown>): string[] {
  const t = n['@type'];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  if (typeof t === 'string') return [t];
  return [];
}

export const htmlJsonLd: PageCheckSpec = {
  id: 'html.json-ld',
  scope: 'page',
  name: 'Has parseable JSON-LD block',
  group: 'Structured data',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the page has at least one <script type="application/ld+json"> block whose content parses as JSON.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const r = parseJsonLd(ctx as PageCheckContext);
        return r.blocks.length > 0
          ? { status: 'pass', message: `${r.blocks.length} block(s)` }
          : { status: 'fail', message: 'no parseable JSON-LD found' };
      },
    },
  },
};

export const htmlJsonLdDateModified: PageCheckSpec = {
  id: 'html.json-ld.date-modified',
  scope: 'page',
  name: 'JSON-LD declares dateModified',
  group: 'Structured data',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if any JSON-LD node on the page contains a non-empty dateModified field.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const r = parseJsonLd(ctx as PageCheckContext);
        if (r.blocks.length === 0) return { status: 'na', message: 'no JSON-LD on page' };
        const found = r.flat.find((n) => typeof n.dateModified === 'string' && n.dateModified);
        return found
          ? { status: 'pass', message: String(found.dateModified) }
          : { status: 'fail', message: 'no dateModified anywhere in JSON-LD' };
      },
    },
  },
};

export const htmlJsonLdBreadcrumb: PageCheckSpec = {
  id: 'html.json-ld.breadcrumb',
  scope: 'page',
  name: 'JSON-LD declares a BreadcrumbList',
  group: 'Structured data',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if any JSON-LD node on the page has @type "BreadcrumbList".',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const r = parseJsonLd(ctx as PageCheckContext);
        if (r.blocks.length === 0) return { status: 'na', message: 'no JSON-LD on page' };
        const found = r.flat.some((n) => nodeType(n).includes('BreadcrumbList'));
        return found
          ? { status: 'pass' }
          : { status: 'fail', message: 'no BreadcrumbList node' };
      },
    },
  },
};

registerCheck(htmlJsonLd);
registerCheck(htmlJsonLdDateModified);
registerCheck(htmlJsonLdBreadcrumb);
