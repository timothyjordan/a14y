/**
 * Thin wrapper around @a14y/core that exposes everything the Astro
 * page templates need at build time. Pages and components import from
 * here, never from @a14y/core directly, so the boundary is clean
 * and the registry shape can change without rippling through templates.
 */
import {
  LATEST_SCORECARD,
  getScorecard,
  listScorecards,
  type ResolvedCheck,
  type ResolvedScorecard,
  type ScorecardManifest,
} from '@a14y/core';

export interface CheckSummary {
  id: string;
  name: string;
  scope: 'site' | 'page';
  group: string;
  implementationVersion: string;
  description: string;
}

export function listAllScorecards(): ScorecardManifest[] {
  return listScorecards();
}

export function getLatestScorecardVersion(): string {
  return LATEST_SCORECARD;
}

export function getScorecardByVersion(version: string): ResolvedScorecard {
  return getScorecard(version);
}

export function getCheckSummariesForScorecard(version: string): CheckSummary[] {
  const scorecard = getScorecard(version);
  return [...scorecard.siteChecks, ...scorecard.pageChecks].map(toSummary);
}

export function getCheckSummary(version: string, id: string): CheckSummary | null {
  const scorecard = getScorecard(version);
  const all = [...scorecard.siteChecks, ...scorecard.pageChecks];
  const found = all.find((c) => c.id === id);
  return found ? toSummary(found) : null;
}

/**
 * Group the checks in a scorecard by their declared `group` property,
 * preserving the registration order within each group. Used by the
 * scorecard overview page to render category headings with their checks
 * underneath.
 */
export function getChecksGroupedByCategory(
  version: string,
): Array<{ group: string; scope: 'site' | 'page'; checks: CheckSummary[] }> {
  const summaries = getCheckSummariesForScorecard(version);
  const order: string[] = [];
  const buckets = new Map<string, { group: string; scope: 'site' | 'page'; checks: CheckSummary[] }>();
  for (const c of summaries) {
    const key = `${c.scope}::${c.group}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { group: c.group, scope: c.scope, checks: [] };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.checks.push(c);
  }
  return order.map((k) => buckets.get(k)!);
}

function toSummary(c: ResolvedCheck): CheckSummary {
  return {
    id: c.id,
    name: c.name,
    scope: c.scope,
    group: c.group ?? 'Other',
    implementationVersion: c.implementationVersion,
    description: c.description,
  };
}
