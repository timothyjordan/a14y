import { registerCheck } from '../../scorecard/registry';
import type { SiteCheckContext, SiteCheckSpec } from '../../scorecard/types';
import type { FetchedPage } from '../../fetch/types';
import { DISCOVERY_INDEXED_KEY } from '../page/discovery';
import { mirrorCandidates } from '../page/markdown';

/**
 * Shared-map key the runner populates with `originalUrl -> hasAgentLink`
 * after the page fan-out completes, for every crawled HTML page. Read by
 * this file's `after-pages` `discovery.in-page-link` check. Mirrors the
 * `CANONICAL_INDEX_KEY` accumulator used by `discovery.no-duplicate-content`.
 */
export const AGENT_LINKS_INDEX_KEY = 'pages:agent-links-map';

/**
 * File names that identify an agent-discovery file regardless of where they
 * live (origin root, `/.well-known/`, `/docs/`, or a subpath-hosted prefix) —
 * matching on the last path segment keeps the check agnostic to hosting layout.
 * This is the set the published spec page names; `agents.md` covers the common
 * `AGENTS.md` casing too (compared lowercased).
 */
const AGENT_FILE_BASENAMES = new Set(['llms.txt', 'llms-full.txt', 'sitemap.md', 'agents.md']);

/**
 * True if the page's served HTML contains an in-DOM `<a href>` that resolves
 * to an agent-discovery file: one of the well-known agent files (by basename),
 * or this page's own `.md`/`.mdx` mirror. Only same-host links count — a link
 * to some other site's llms.txt does not make *this* site discoverable.
 *
 * Called by the runner during the page fan-out while the cheerio handle is
 * still live; the cross-page top-vs-deep grading happens later in the check.
 */
export function pageLinksToAgentFile(page: FetchedPage): boolean {
  let selfHost: string;
  try {
    selfHost = new URL(page.url).host;
  } catch {
    return false;
  }
  const mirrors = new Set(mirrorCandidates(page.url));
  const hrefs = page
    .$('a[href]')
    .toArray()
    .map((el) => page.$(el).attr('href') ?? '');
  for (const raw of hrefs) {
    if (!raw) continue;
    let abs: URL;
    try {
      abs = new URL(raw, page.url);
    } catch {
      continue;
    }
    if (abs.host !== selfHost) continue;
    const basename = abs.pathname.split('/').pop()?.toLowerCase() ?? '';
    if (AGENT_FILE_BASENAMES.has(basename)) return true;
    if (mirrors.has(`${abs.protocol}//${abs.host}${abs.pathname}`)) return true;
  }
  return false;
}

/** Count of non-empty `/`-delimited path segments, e.g. `/a/b` -> 2, `/` -> 0. */
function pathDepth(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

export const discoveryInPageLink: SiteCheckSpec = {
  id: 'discovery.in-page-link',
  scope: 'site',
  name: 'Agent files are linked in-page',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      phase: 'after-pages',
      description:
        'Pass if a top-level page (the root URL or a first-level path like /docs) links in-page (in-DOM <a href>) to an agent-discovery file (/llms.txt, /llms-full.txt, /sitemap.md, /AGENTS.md, or the page\'s .md mirror); warn if only a deeper page does; fail if no crawled page does. N/A in single-page mode.',
      run: async (ctx) => {
        const c = ctx as SiteCheckContext;
        // DISCOVERY_INDEXED_KEY is set by the runner only in site mode. Its
        // absence means single-page mode, where there's no cross-page view to
        // tell a top-level page from a deep one.
        if (!c.shared.get(DISCOVERY_INDEXED_KEY)) {
          return { status: 'na', message: 'single-page mode' };
        }
        const idx = c.shared.get(AGENT_LINKS_INDEX_KEY) as Map<string, boolean> | undefined;
        if (!idx || idx.size === 0) {
          return { status: 'na', message: 'no pages crawled' };
        }
        // Depth is measured relative to the site root so subpath-hosted sites
        // (e.g. /docs) treat their own root as top-level.
        const rootDepth = pathDepth(c.sitePrefix ?? '');
        let topLevelLinked = false;
        let deepExample: string | undefined;
        for (const [url, hasLink] of idx) {
          if (!hasLink) continue;
          let depth: number;
          try {
            depth = Math.max(0, pathDepth(new URL(url).pathname) - rootDepth);
          } catch {
            depth = 0;
          }
          if (depth <= 1) {
            topLevelLinked = true;
          } else if (!deepExample) {
            deepExample = url;
          }
        }
        if (topLevelLinked) {
          return { status: 'pass', message: 'a top-level page links to an agent file' };
        }
        if (deepExample) {
          return {
            status: 'warn',
            message: `agent files linked only on deeper pages (e.g. ${deepExample})`,
          };
        }
        return { status: 'fail', message: 'no page links to an agent file in-page' };
      },
    },
  },
};

registerCheck(discoveryInPageLink);
