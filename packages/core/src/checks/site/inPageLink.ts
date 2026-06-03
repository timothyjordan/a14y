import { registerCheck } from '../../scorecard/registry';
import type { SiteCheckSpec } from '../../scorecard/types';

/**
 * Spec placeholder ahead of the impl PR.
 *
 * The contract: shipping agent-discovery files (`/llms.txt`, `/sitemap.md`,
 * `/AGENTS.md`, a page's `.md` mirror) is necessary but not sufficient.
 * Starship-pilot request logs (TJ-648 / TJ-662) show an agent handed a bare
 * URL crawls HTML and may never probe for those files. A visible in-page "For
 * agents" link block is what lets an agent discover them at all (it's exactly
 * what a14y.dev itself does). This is a discoverability signal, not a promised
 * efficiency lever; the token win did not reliably replicate at n=5.
 *
 * It is a SITE-wide, `after-pages` check (the files need to be linked
 * *somewhere*, not on every page), so it needs the cross-page view the runner
 * only has once the page queue drains; mirrors `discovery.no-duplicate-content`
 * in `duplicateContent.ts`. Across the crawl it looks for an in-DOM `<a href>`
 * resolving to `/llms.txt` (or `/llms-full.txt`), `/sitemap.md`, `/AGENTS.md`,
 * or the page's own `.md` mirror, and grades by where that link lives:
 *   - pass: a top-level page (the root URL or a first-level path like
 *           `/docs`) carries such a link;
 *   - warn: no top-level page has one but a deeper page does;
 *   - fail: no crawled page links to any agent file;
 *   - na:   single-page mode (no cross-page top-vs-deep view).
 *
 * Returns `na` until the detector ships in the follow-up implementation PR, so
 * it contributes nothing to the draft score in the meantime.
 */
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
        'Pass if a top-level page (the root URL or a first-level path like /docs) links in-page (in-DOM <a href>) to an agent-discovery file (/llms.txt, /llms-full.txt, /sitemap.md, /AGENTS.md, or the page\'s .md mirror); warn if only a deeper page does; fail if no crawled page does. N/A in single-page mode. Spec placeholder: detection ships in the follow-up implementation PR.',
      run: async () => ({ status: 'na', message: 'spec placeholder: detection ships in the impl PR' }),
    },
  },
};

registerCheck(discoveryInPageLink);
