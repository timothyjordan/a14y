import { registerCheck } from '../../scorecard/registry';
import type { SiteCheckContext, SiteCheckSpec } from '../../scorecard/types';
import { wellKnownCandidates } from './_wellKnown';
import { looksLikeHtml } from './_contentType';

const SHARED_KEY = 'site:agents-md';

const PATHS = [
  '/AGENTS.md',
  '/agents.md',
  '/.well-known/agents.md',
  '/docs/AGENTS.md',
  '/llms-full.txt',
  '/CLAUDE.md',
  '/.cursor/rules',
  '/.cursorrules',
];

interface AgentsMdResource {
  found: boolean;
  url?: string;
  body?: string;
  contentType?: string;
  /** Which of install/configuration/usage sections were detected. */
  sectionsFound?: string[];
}

const SECTION_PATTERNS: Array<{ key: string; re: RegExp }> = [
  { key: 'installation', re: /\b(install(ation)?|getting started|quickstart)\b/i },
  { key: 'configuration', re: /\b(configuration|config|settings|options)\b/i },
  { key: 'usage', re: /\b(usage|examples?|how to|reference|api)\b/i },
];

function detectSections(body: string): string[] {
  // Only look at heading lines so prose mentions don't false-positive.
  const headings = (body.match(/^#{1,6}\s.+$/gm) ?? []).join('\n');
  const found: string[] = [];
  for (const { key, re } of SECTION_PATTERNS) {
    if (re.test(headings)) found.push(key);
  }
  return found;
}

async function loadAgentsMd(ctx: SiteCheckContext): Promise<AgentsMdResource> {
  const cached = ctx.shared.get(SHARED_KEY) as AgentsMdResource | undefined;
  if (cached) return cached;

  let result: AgentsMdResource = { found: false };
  for (const url of wellKnownCandidates(ctx, PATHS)) {
    try {
      const resp = await ctx.http.fetch(url);
      if (resp.status >= 200 && resp.status < 300) {
        result = {
          found: true,
          url: resp.url,
          body: resp.body,
          contentType: resp.headers.get('content-type') ?? undefined,
          sectionsFound: detectSections(resp.body),
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

export const agentsMdExists: SiteCheckSpec = {
  id: 'agents-md.exists',
  scope: 'site',
  name: 'AGENTS.md (or equivalent) is published',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if any of AGENTS.md, agents.md, .well-known/agents.md, docs/AGENTS.md, llms-full.txt, CLAUDE.md, .cursor/rules, or .cursorrules is reachable.',
      run: async (ctx) => {
        const r = await loadAgentsMd(ctx as SiteCheckContext);
        return r.found
          ? { status: 'pass', message: r.url }
          : { status: 'fail', message: 'No agent skill file found' };
      },
    },
    '1.1.0': {
      version: '1.1.0',
      description:
        'Pass if a 2xx agent skill file is found that is not an HTML page (a soft-200 SPA shell or styled 404 does not count).',
      run: async (ctx) => {
        const r = await loadAgentsMd(ctx as SiteCheckContext);
        if (!r.found) return { status: 'fail', message: 'No agent skill file found' };
        if (looksLikeHtml(r.body ?? '', r.contentType)) {
          return {
            status: 'fail',
            message: `${r.url} returned an HTML page, not an agent skill file`,
          };
        }
        return { status: 'pass', message: r.url };
      },
    },
  },
};

export const agentsMdHasMinSections: SiteCheckSpec = {
  id: 'agents-md.has-min-sections',
  scope: 'site',
  name: 'agent skill file documents at least 2 of install/config/usage',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the discovered skill file has heading-level sections matching at least 2 of: installation, configuration, usage/examples.',
      run: async (ctx) => {
        const r = await loadAgentsMd(ctx as SiteCheckContext);
        if (!r.found) return { status: 'na', message: 'No skill file present' };
        const found = r.sectionsFound ?? [];
        return found.length >= 2
          ? { status: 'pass', message: `Found: ${found.join(', ')}` }
          : {
              status: 'fail',
              message: `Found only: ${found.join(', ') || '(none)'}`,
            };
      },
    },
  },
};

registerCheck(agentsMdExists);
registerCheck(agentsMdHasMinSections);
