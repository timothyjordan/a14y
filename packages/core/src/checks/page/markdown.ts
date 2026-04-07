import grayMatter from 'gray-matter';
import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';
import { htmlOnly } from './_htmlOnly';

// gray-matter is a CJS module whose `module.exports` is the matter
// function itself. Different runtimes / bundlers normalise the default
// export differently:
//
//   - Node ESM and tsc emitting CJS hand us the function directly
//     (the CLI build uses dist/cjs and works correctly)
//   - rollup's @rollup/plugin-commonjs (used by Vite to bundle the
//     Chrome extension) sometimes wraps it as { default: function }
//     so `matter` is the namespace object, not the function
//
// Calling the namespace object errors silently and parsed.data is
// empty, which makes every page on the docs site fail
// markdown.frontmatter even though the source files are correct.
// Detect both shapes and unwrap when needed.
type MatterFn = typeof grayMatter;
const matter: MatterFn =
  (grayMatter as unknown as { default?: MatterFn }).default ?? grayMatter;

const SHARED_KEY_PREFIX = 'page:md-mirror:';
const GROUP = 'Markdown mirror';

interface MarkdownMirror {
  found: boolean;
  url?: string;
  body?: string;
  contentType?: string;
  linkHeader?: string;
  frontmatter?: Record<string, unknown>;
}

/**
 * Try every URL pattern that might host a markdown mirror of `page.url`,
 * cache the first hit on the page-scoped shared map, and reuse it across
 * the markdown.* checks.
 */
async function loadMirror(ctx: PageCheckContext): Promise<MarkdownMirror> {
  const cacheKey = SHARED_KEY_PREFIX + ctx.url;
  const cached = ctx.shared.get(cacheKey) as MarkdownMirror | undefined;
  if (cached) return cached;

  const candidates = mirrorCandidates(ctx.url);
  let result: MarkdownMirror = { found: false };
  for (const candidate of candidates) {
    try {
      const resp = await ctx.http.fetch(candidate);
      if (resp.status >= 200 && resp.status < 300) {
        let frontmatter: Record<string, unknown> | undefined;
        try {
          const parsed = matter(resp.body);
          frontmatter = parsed.data as Record<string, unknown>;
        } catch {
          frontmatter = undefined;
        }
        result = {
          found: true,
          url: resp.url,
          body: resp.body,
          contentType: resp.headers.get('content-type') ?? undefined,
          linkHeader: resp.headers.get('link') ?? undefined,
          frontmatter,
        };
        break;
      }
    } catch {
      // try next
    }
  }
  ctx.shared.set(cacheKey, result);
  return result;
}

function mirrorCandidates(pageUrl: string): string[] {
  const u = new URL(pageUrl);
  const path = u.pathname;
  // Strip a trailing slash and any .html extension before appending .md/.mdx
  let base = path;
  const hadTrailingSlash = base.endsWith('/');
  if (hadTrailingSlash) base = base.slice(0, -1);
  if (base.endsWith('.html')) base = base.slice(0, -5);
  if (base === '') base = '/index';
  const out: string[] = [`${base}.md`, `${base}.mdx`];
  // For trailing-slash URLs (Astro / Hugo / many SSGs default), also
  // try the in-directory mirror at <path>/index.md. The plain
  // `<path>.md` can resolve to a parent directory the site doesn't
  // own — for example `https://timothyjordan.github.io/agentready/`
  // would otherwise look for `/agentready.md` which lives outside
  // the docs site's subpath.
  if (hadTrailingSlash) {
    out.push(`${base}/index.md`, `${base}/index.mdx`);
  }
  return out.map((p) => new URL(p, `${u.protocol}//${u.host}`).toString());
}

export const markdownMirrorSuffix: PageCheckSpec = {
  id: 'markdown.mirror-suffix',
  scope: 'page',
  name: 'Has .md or .mdx mirror',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the corresponding <page>.md or <page>.mdx URL returns 2xx.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const r = await loadMirror(ctx as PageCheckContext);
        return r.found
          ? { status: 'pass', message: r.url }
          : { status: 'fail', message: 'no .md/.mdx mirror found' };
      },
    },
  },
};

export const markdownAlternateLink: PageCheckSpec = {
  id: 'markdown.alternate-link',
  scope: 'page',
  name: 'HTML declares <link rel="alternate" type="text/markdown">',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the HTML page advertises a markdown alternate via <link rel="alternate">.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const href = (ctx as PageCheckContext).page
          .$('link[rel="alternate"][type="text/markdown"]')
          .attr('href');
        return href
          ? { status: 'pass', message: href }
          : { status: 'fail', message: 'no <link rel="alternate" type="text/markdown">' };
      },
    },
  },
};

export const markdownFrontmatter: PageCheckSpec = {
  id: 'markdown.frontmatter',
  scope: 'page',
  name: 'Markdown mirror has required frontmatter',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the markdown mirror has YAML frontmatter declaring title, description, doc_version, and last_updated.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const r = await loadMirror(ctx as PageCheckContext);
        if (!r.found) return { status: 'na', message: 'no mirror to inspect' };
        const fm = r.frontmatter ?? {};
        const required = ['title', 'description', 'doc_version', 'last_updated'];
        const missing = required.filter((k) => !(k in fm));
        return missing.length === 0
          ? { status: 'pass' }
          : { status: 'fail', message: `missing: ${missing.join(', ')}` };
      },
    },
  },
};

export const markdownCanonicalHeader: PageCheckSpec = {
  id: 'markdown.canonical-header',
  scope: 'page',
  name: 'Markdown mirror sends canonical Link header',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the markdown mirror response includes a Link header with rel="canonical".',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const r = await loadMirror(ctx as PageCheckContext);
        if (!r.found) return { status: 'na', message: 'no mirror to inspect' };
        const link = r.linkHeader ?? '';
        return /rel\s*=\s*"?canonical"?/i.test(link)
          ? { status: 'pass', message: link }
          : { status: 'fail', message: link || 'no Link header' };
      },
    },
  },
};

export const markdownContentNegotiation: PageCheckSpec = {
  id: 'markdown.content-negotiation',
  scope: 'page',
  name: 'Server returns markdown for Accept: text/markdown',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if refetching the page URL with Accept: text/markdown returns a text/markdown response.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const c = ctx as PageCheckContext;
        try {
          const resp = await c.http.fetch(c.url, {
            headers: { accept: 'text/markdown' },
          });
          const ct = (resp.headers.get('content-type') ?? '').toLowerCase();
          return ct.includes('text/markdown') || ct.includes('text/x-markdown')
            ? { status: 'pass', message: ct }
            : { status: 'fail', message: ct || '(no content-type)' };
        } catch (e) {
          return { status: 'error', message: (e as Error).message };
        }
      },
    },
  },
};

export const markdownSitemapSection: PageCheckSpec = {
  id: 'markdown.sitemap-section',
  scope: 'page',
  name: 'Markdown mirror includes a Sitemap section',
  group: GROUP,
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the markdown mirror body contains a "## Sitemap" heading.',
      run: async (ctx) => {
        const skip = htmlOnly(ctx as PageCheckContext);
        if (skip) return skip;
        const r = await loadMirror(ctx as PageCheckContext);
        if (!r.found) return { status: 'na', message: 'no mirror to inspect' };
        return /^##\s+Sitemap\b/m.test(r.body ?? '')
          ? { status: 'pass' }
          : { status: 'fail', message: 'no "## Sitemap" heading in mirror' };
      },
    },
  },
};

registerCheck(markdownMirrorSuffix);
registerCheck(markdownAlternateLink);
registerCheck(markdownFrontmatter);
registerCheck(markdownCanonicalHeader);
registerCheck(markdownContentNegotiation);
registerCheck(markdownSitemapSection);
