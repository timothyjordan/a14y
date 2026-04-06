import { registerCheck } from '../../scorecard/registry';
import type { SiteCheckContext, SiteCheckSpec } from '../../scorecard/types';

const SHARED_KEY = 'site:llms-txt';

const PRIMARY_PATHS = ['/llms.txt', '/.well-known/llms.txt', '/docs/llms.txt'];
const FULL_PATHS = ['/llms-full.txt', '/.well-known/llms-full.txt', '/docs/llms-full.txt'];

interface LlmsTxtResource {
  found: boolean;
  /** Final URL where the file was located. */
  url?: string;
  /** Whether the matched file was an llms-full.txt instead of llms.txt. */
  isFull?: boolean;
  contentType?: string;
  body?: string;
  /** All `[label](url)` links extracted from the body. */
  links?: string[];
}

async function loadLlmsTxt(ctx: SiteCheckContext): Promise<LlmsTxtResource> {
  const cached = ctx.shared.get(SHARED_KEY) as LlmsTxtResource | undefined;
  if (cached) return cached;

  const tryPaths = async (paths: string[], isFull: boolean): Promise<LlmsTxtResource | null> => {
    for (const path of paths) {
      try {
        const resp = await ctx.http.fetch(new URL(path, ctx.baseUrl).toString());
        if (resp.status >= 200 && resp.status < 300) {
          return {
            found: true,
            url: resp.url,
            isFull,
            contentType: resp.headers.get('content-type') ?? undefined,
            body: resp.body,
            links: extractMarkdownLinks(resp.body),
          };
        }
      } catch {
        // ignore network errors and try next path
      }
    }
    return null;
  };

  const primary = await tryPaths(PRIMARY_PATHS, false);
  const result = primary ?? (await tryPaths(FULL_PATHS, true)) ?? { found: false };
  ctx.shared.set(SHARED_KEY, result);
  return result;
}

function extractMarkdownLinks(body: string): string[] {
  const out: string[] = [];
  const re = /\[[^\]]+\]\(([^)\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) out.push(m[1]);
  return out;
}

export const llmsTxtExists: SiteCheckSpec = {
  id: 'llms-txt.exists',
  scope: 'site',
  name: 'llms.txt is published',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if llms.txt or llms-full.txt is reachable at /, /.well-known/, or /docs/.',
      run: async (ctx) => {
        const r = await loadLlmsTxt(ctx as SiteCheckContext);
        if (!r.found) {
          return {
            status: 'fail',
            message:
              'No llms.txt or llms-full.txt found at /, /.well-known/, or /docs/',
          };
        }
        return {
          status: 'pass',
          message: `Found ${r.isFull ? 'llms-full.txt' : 'llms.txt'} at ${r.url}`,
        };
      },
    },
  },
};

export const llmsTxtContentType: SiteCheckSpec = {
  id: 'llms-txt.content-type',
  scope: 'site',
  name: 'llms.txt served as text/plain',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the llms.txt response Content-Type starts with text/plain.',
      run: async (ctx) => {
        const r = await loadLlmsTxt(ctx as SiteCheckContext);
        if (!r.found) return { status: 'na', message: 'llms.txt not present' };
        const ct = (r.contentType ?? '').toLowerCase();
        return ct.includes('text/plain')
          ? { status: 'pass', message: ct }
          : {
              status: 'warn',
              message: `Content-Type is "${ct || '(missing)'}", expected text/plain`,
            };
      },
    },
  },
};

export const llmsTxtNonEmpty: SiteCheckSpec = {
  id: 'llms-txt.non-empty',
  scope: 'site',
  name: 'llms.txt is not empty',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if the llms.txt body has any non-whitespace content.',
      run: async (ctx) => {
        const r = await loadLlmsTxt(ctx as SiteCheckContext);
        if (!r.found) return { status: 'na', message: 'llms.txt not present' };
        return (r.body ?? '').trim().length > 0
          ? { status: 'pass' }
          : { status: 'fail', message: 'llms.txt is empty' };
      },
    },
  },
};

export const llmsTxtMdExtensions: SiteCheckSpec = {
  id: 'llms-txt.md-extensions',
  scope: 'site',
  name: 'llms.txt links use .md or .mdx',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if every link in llms.txt points at a .md or .mdx URL (the format agents can ingest cleanly).',
      run: async (ctx) => {
        const r = await loadLlmsTxt(ctx as SiteCheckContext);
        if (!r.found) return { status: 'na', message: 'llms.txt not present' };
        const links = r.links ?? [];
        if (links.length === 0) {
          return { status: 'warn', message: 'llms.txt contains no links to evaluate' };
        }
        const bad = links.filter((href) => {
          const path = href.split(/[?#]/)[0];
          return !(path.endsWith('.md') || path.endsWith('.mdx'));
        });
        return bad.length === 0
          ? { status: 'pass', message: `${links.length} links checked` }
          : {
              status: 'fail',
              message: `${bad.length}/${links.length} links are not .md/.mdx`,
              details: { offenders: bad.slice(0, 10) },
            };
      },
    },
  },
};

registerCheck(llmsTxtExists);
registerCheck(llmsTxtContentType);
registerCheck(llmsTxtNonEmpty);
registerCheck(llmsTxtMdExtensions);
