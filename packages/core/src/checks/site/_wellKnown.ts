import type { SiteCheckContext } from '../../scorecard/types';

/**
 * Build the candidate URL list for a well-known site-level file.
 *
 * For sites at the origin root (`sitePrefix` empty or absent), the
 * behaviour is identical to the original loaders: try each path verbatim
 * relative to `baseUrl`. Existing tests against origin-rooted fixtures
 * keep passing unchanged.
 *
 * For subpath-hosted sites (`sitePrefix === '/agentready'`), the helper
 * tries the subpath-rooted variant first (`<origin>/agentready/llms.txt`)
 * and only falls back to the origin-rooted variant if the subpath copy
 * is missing. This matches how a user typically publishes well-known
 * files on shared domains: under their own subpath, where they control
 * the contents.
 */
export function wellKnownCandidates(
  ctx: SiteCheckContext,
  paths: string[],
): string[] {
  const prefix = (ctx.sitePrefix ?? '').replace(/\/$/, '');
  const originRooted = paths.map((p) => new URL(p, ctx.baseUrl).toString());
  if (!prefix) return originRooted;
  const subpathRooted = paths.map((p) =>
    new URL(prefix + p, ctx.baseUrl).toString(),
  );
  return [...subpathRooted, ...originRooted];
}
