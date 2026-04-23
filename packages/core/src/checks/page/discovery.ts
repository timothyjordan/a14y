import { registerCheck } from '../../scorecard/registry';
import type { PageCheckContext, PageCheckSpec } from '../../scorecard/types';

/**
 * Shared-map key the runner uses to publish the union of URLs that were
 * announced by any seed source (sitemap.xml / llms.txt / sitemap.md). The
 * runner populates this once before page checks fan out.
 */
export const DISCOVERY_INDEXED_KEY = 'discovery:indexed-set';

export const discoveryIndexed: PageCheckSpec = {
  id: 'discovery.indexed',
  scope: 'page',
  name: 'Page is indexed by sitemap, llms.txt, or sitemap.md',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the page URL appears in at least one of the discovered indexes (sitemap.xml, llms.txt, sitemap.md). Pages found only by link crawling fail this check.',
      run: async (ctx) => {
        const c = ctx as PageCheckContext;
        const set = c.shared.get(DISCOVERY_INDEXED_KEY) as Set<string> | undefined;
        if (!set) {
          // Single-page mode: there's no site-wide index, so the question is
          // not meaningful. Return na so the score is unaffected.
          return { status: 'na', message: 'no site index available' };
        }
        return set.has(c.url)
          ? { status: 'pass' }
          : { status: 'fail', message: 'orphaned (not announced by any index)' };
      },
    },
  },
};

registerCheck(discoveryIndexed);
