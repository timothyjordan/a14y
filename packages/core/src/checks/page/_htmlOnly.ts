import type { CheckOutcome, PageCheckContext } from '../../scorecard/types';

/**
 * Guard for page-level checks that only make sense on HTML responses.
 *
 * Site-mode crawlers can discover non-HTML URLs (e.g. `.md` mirrors
 * announced from llms.txt) and route them through the page-check
 * pipeline. Without this guard, every HTML-content check would
 * blindly fail on those responses ("missing canonical link", "no
 * JSON-LD", etc.) — they're not failures of the site, the check just
 * doesn't apply to that response type.
 *
 * Use as an early return at the top of any check that interrogates
 * `<head>`, `<body>`, structured data, or any other HTML-specific
 * artefact:
 *
 * ```ts
 * run: async (ctx) => {
 *   const skip = htmlOnly(ctx as PageCheckContext);
 *   if (skip) return skip;
 *   // ...real check logic against ctx.page.$ ...
 * }
 * ```
 *
 * Transport-layer checks (`http.status-200`, `http.redirect-chain`,
 * `http.no-noindex-noai`) do NOT use this helper — they evaluate
 * meaningfully on any response.
 */
export function htmlOnly(ctx: PageCheckContext): CheckOutcome | null {
  const ct = (ctx.page.headers.get('content-type') ?? '').toLowerCase();
  if (ct.includes('text/html')) return null;
  return {
    status: 'na',
    message: `not an HTML response (content-type: ${ct || '(missing)'})`,
  };
}
