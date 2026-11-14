import robotsParser from 'robots-parser';
import { registerCheck } from '../../scorecard/registry';
import type { SiteCheckContext, SiteCheckSpec } from '../../scorecard/types';
import { wellKnownCandidates } from './_wellKnown';

const SHARED_KEY = 'site:robots-txt';

const AI_BOTS = ['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended'];

interface RobotsTxtResource {
  found: boolean;
  url?: string;
  body?: string;
  parser?: ReturnType<typeof robotsParser>;
  /**
   * The same rules, bound to the URL we requested rather than the one the
   * file was finally served from. robots-parser refuses to answer for URLs
   * on any host but the one it was built for -- isAllowed() returns
   * undefined, and isDisallowed() turns that into true -- so `parser` gets
   * every scanned-host URL wrong when /robots.txt redirects to another
   * host. Per RFC 9309 a redirected robots.txt governs the host it was
   * requested for, so this is the parser 1.1.0+ checks should consult.
   * `parser` stays as it was for the frozen 1.0.0 implementations.
   */
  requestedHostParser?: ReturnType<typeof robotsParser>;
}

async function loadRobotsTxt(ctx: SiteCheckContext): Promise<RobotsTxtResource> {
  const cached = ctx.shared.get(SHARED_KEY) as RobotsTxtResource | undefined;
  if (cached) return cached;

  let result: RobotsTxtResource = { found: false };
  for (const url of wellKnownCandidates(ctx, ['/robots.txt'])) {
    try {
      const resp = await ctx.http.fetch(url);
      if (resp.status >= 200 && resp.status < 300) {
        result = {
          found: true,
          url: resp.url,
          body: resp.body,
          parser: robotsParser(resp.url, resp.body),
          requestedHostParser: robotsParser(url, resp.body),
        };
        break;
      }
    } catch {
      // ignore network errors and try next path
    }
  }

  ctx.shared.set(SHARED_KEY, result);
  return result;
}

export const robotsTxtExists: SiteCheckSpec = {
  id: 'robots-txt.exists',
  scope: 'site',
  name: 'robots.txt is published',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description: 'Pass if /robots.txt returns a 2xx response.',
      run: async (ctx) => {
        const r = await loadRobotsTxt(ctx as SiteCheckContext);
        return r.found
          ? { status: 'pass', message: r.url }
          : { status: 'fail', message: '/robots.txt not reachable' };
      },
    },
  },
};

export const robotsTxtAllowsAiBots: SiteCheckSpec = {
  id: 'robots-txt.allows-ai-bots',
  scope: 'site',
  name: 'robots.txt allows AI bots',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if robots.txt does not disallow GPTBot, ClaudeBot, CCBot, or Google-Extended from fetching the site root.',
      run: async (ctx) => {
        const r = await loadRobotsTxt(ctx as SiteCheckContext);
        if (!r.found || !r.parser) {
          // No robots.txt means an implicit allow-all, which is fine.
          return { status: 'pass', message: 'No robots.txt; defaults to allow all' };
        }
        const root = new URL('/', (ctx as SiteCheckContext).baseUrl).toString();
        const blocked = AI_BOTS.filter((bot) => r.parser!.isDisallowed(root, bot));
        return blocked.length === 0
          ? { status: 'pass', message: `Allowed: ${AI_BOTS.join(', ')}` }
          : {
              status: 'fail',
              message: `Blocks: ${blocked.join(', ')}`,
              details: { blocked },
            };
      },
    },
    '1.1.0': {
      version: '1.1.0',
      description:
        'Pass if robots.txt does not disallow GPTBot, ClaudeBot, CCBot, or Google-Extended from fetching the site root, applying the rules to the scanned host even when robots.txt redirects to another host.',
      run: async (ctx) => {
        const r = await loadRobotsTxt(ctx as SiteCheckContext);
        const parser = r.requestedHostParser;
        if (!r.found || !parser) {
          return { status: 'pass', message: 'No robots.txt; defaults to allow all' };
        }
        const root = new URL('/', (ctx as SiteCheckContext).baseUrl).toString();
        const blocked = AI_BOTS.filter((bot) => parser.isDisallowed(root, bot));
        return blocked.length === 0
          ? { status: 'pass', message: `Allowed: ${AI_BOTS.join(', ')}` }
          : {
              status: 'fail',
              message: `Blocks: ${blocked.join(', ')}`,
              details: { blocked },
            };
      },
    },
  },
};

export const robotsTxtAllowsLlmsTxt: SiteCheckSpec = {
  id: 'robots-txt.allows-llms-txt',
  scope: 'site',
  name: 'robots.txt does not disallow llms.txt',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if /llms.txt and /.well-known/llms.txt are reachable to all user-agents per robots.txt rules.',
      run: async (ctx) => {
        const r = await loadRobotsTxt(ctx as SiteCheckContext);
        if (!r.found || !r.parser) return { status: 'pass', message: 'No robots.txt' };
        const checks = ['/llms.txt', '/.well-known/llms.txt'].map((p) =>
          new URL(p, (ctx as SiteCheckContext).baseUrl).toString(),
        );
        const blocked = checks.filter((u) => r.parser!.isDisallowed(u, '*'));
        return blocked.length === 0
          ? { status: 'pass' }
          : {
              status: 'fail',
              message: `robots.txt disallows: ${blocked.join(', ')}`,
            };
      },
    },
    '1.1.0': {
      version: '1.1.0',
      description:
        'Pass if /llms.txt and /.well-known/llms.txt are reachable to all user-agents per robots.txt rules, applying the rules to the scanned host even when robots.txt redirects to another host.',
      run: async (ctx) => {
        const r = await loadRobotsTxt(ctx as SiteCheckContext);
        const parser = r.requestedHostParser;
        if (!r.found || !parser) return { status: 'pass', message: 'No robots.txt' };
        const checks = ['/llms.txt', '/.well-known/llms.txt'].map((p) =>
          new URL(p, (ctx as SiteCheckContext).baseUrl).toString(),
        );
        const blocked = checks.filter((u) => parser.isDisallowed(u, '*'));
        return blocked.length === 0
          ? { status: 'pass' }
          : {
              status: 'fail',
              message: `robots.txt disallows: ${blocked.join(', ')}`,
            };
      },
    },
  },
};

registerCheck(robotsTxtExists);
registerCheck(robotsTxtAllowsAiBots);
registerCheck(robotsTxtAllowsLlmsTxt);
