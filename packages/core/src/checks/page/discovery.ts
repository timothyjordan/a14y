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

/**
 * Spec placeholder ahead of the impl PR. The contract: across a full
 * site crawl, fail if multiple announced URLs collapse to the same
 * canonical (or otherwise serve duplicate content). Duplicate URLs waste
 * an agent's token budget re-reading the same material, and waste crawl
 * resources — Google flags the same problem for AI search. Like
 * `discovery.indexed`, this is meaningful only with a site-wide view, so
 * it returns `na` in single-page mode (and, for now, everywhere — the
 * detector ships in the follow-up implementation PR).
 */
export const discoveryNoDuplicateContent: PageCheckSpec = {
  id: 'discovery.no-duplicate-content',
  scope: 'page',
  name: 'Page is not a duplicate of another crawled URL',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      description:
        'Pass if the page does not share its canonical with another announced URL (no duplicate content across the crawl). N/A in single-page mode. Spec placeholder — detection ships in the follow-up implementation PR.',
      run: async () => ({ status: 'na', message: 'spec placeholder — detection ships in the impl PR' }),
    },
  },
};

registerCheck(discoveryIndexed);
registerCheck(discoveryNoDuplicateContent);
