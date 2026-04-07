import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';
import { htmlOnly } from './_htmlOnly';

const SHARED_KEY_PREFIX = 'page:md-mirror:';
const GROUP = 'Markdown mirror';

interface MarkdownMirror {
  found: boolean;
  url?: string;
  body?: string;
  contentType?: string;
  linkHeader?: string;
  frontmatterKeys?: Set<string>;
}

/**
 * Detect top-level YAML frontmatter keys without pulling in a full
 * YAML parser. The markdown.frontmatter check only needs to know
 * whether each required key is present — it never reads the parsed
 * values. Avoiding gray-matter eliminates a CJS-only dependency that
 * didn't survive rollup's @rollup/plugin-commonjs interop in the
 * extension bundle.
 */
export function detectFrontmatterKeys(body: string): Set<string> {
  if (!body || (!body.startsWith('---\n') && !body.startsWith('---\r\n'))) {
    return new Set();
  }
  // Skip past the opening `---` line.
  const afterOpen = body.indexOf('\n', 3) + 1;
  if (afterOpen <= 0) return new Set();
  // Find the closing `---` line.
  const closeMatch = body.slice(afterOpen).match(/(^|\n)---\s*(\n|$)/);
  if (!closeMatch || closeMatch.index === undefined) return new Set();
  const fmText = body.slice(afterOpen, afterOpen + closeMatch.index);

  const keys = new Set<string>();
  for (const line of fmText.split(/\r?\n/)) {
    // Top-level keys only: lines that start with `<name>:` and are
    // NOT indented (indented lines are children of the previous
    // top-level key in YAML's block-mapping syntax).
    if (/^[ \t]/.test(line)) continue;
    const m = line.match(/^([a-zA-Z_][\w-]*)\s*:/);
    if (m) keys.add(m[1]);
  }
  return keys;
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
        result = {
          found: true,
          url: resp.url,
          body: resp.body,
          contentType: resp.headers.get('content-type') ?? undefined,
          linkHeader: resp.headers.get('link') ?? undefined,
          frontmatterKeys: detectFrontmatterKeys(resp.body),
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
        const have = r.frontmatterKeys ?? new Set<string>();
        const required = ['title', 'description', 'doc_version', 'last_updated'];
        const missing = required.filter((k) => !have.has(k));
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
