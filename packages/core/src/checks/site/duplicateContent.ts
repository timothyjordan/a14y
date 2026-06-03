import { registerCheck } from '../../scorecard/registry';
import type { SiteCheckSpec } from '../../scorecard/types';
import { DISCOVERY_INDEXED_KEY } from '../page/discovery';

/**
 * Shared-map key the runner populates with `originalUrl → canonical`
 * after the page fan-out completes. Read by after-pages site checks
 * that need to reason about cross-page collapse (right now: this
 * file's `discovery.no-duplicate-content`).
 */
export const CANONICAL_INDEX_KEY = 'pages:canonical-map';

export const discoveryNoDuplicateContent: SiteCheckSpec = {
  id: 'discovery.no-duplicate-content',
  scope: 'site',
  name: 'No URLs share a canonical with another announced URL',
  group: 'Discoverability',
  implementations: {
    '1.0.0': {
      version: '1.0.0',
      // after-pages: this check needs the runner's canonical index, which
      // is only populated once every page has been fetched. The runner
      // defers it until the page queue drains.
      phase: 'after-pages',
      description:
        'Pass if no two crawled URLs collapse to the same canonical. N/A in single-page mode (no cross-page view).',
      run: async (ctx) => {
        // DISCOVERY_INDEXED_KEY is set by the runner only in site mode.
        // Its absence is our signal that this is a single-page run.
        if (!ctx.shared.get(DISCOVERY_INDEXED_KEY)) {
          return { status: 'na', message: 'single-page mode' };
        }
        const map = ctx.shared.get(CANONICAL_INDEX_KEY) as
          | Map<string, string>
          | undefined;
        if (!map || map.size === 0) {
          return { status: 'na', message: 'no pages crawled' };
        }
        const groups = new Map<string, string[]>();
        for (const [url, canonical] of map) {
          const list = groups.get(canonical) ?? [];
          list.push(url);
          groups.set(canonical, list);
        }
        const dupes = [...groups.entries()].filter(([, urls]) => urls.length > 1);
        if (dupes.length === 0) {
          return {
            status: 'pass',
            message: `${map.size} URLs, no duplicate canonicals`,
          };
        }
        const example = dupes[0][1].slice(0, 2).join(' & ');
        return {
          status: 'fail',
          message: `${dupes.length} canonical group(s) shared by multiple URLs (e.g. ${example})`,
        };
      },
    },
  },
};

registerCheck(discoveryNoDuplicateContent);
