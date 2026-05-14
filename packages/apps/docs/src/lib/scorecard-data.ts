/**
 * Thin wrapper around @a14y/core that exposes everything the Astro
 * page templates need at build time. Pages and components import from
 * here, never from @a14y/core directly, so the boundary is clean
 * and the registry shape can change without rippling through templates.
 */
import {
  DRAFT_SCORECARD_VERSION,
  LATEST_SCORECARD,
  getScorecard,
  isDraftScorecardVersion,
  listScorecards,
  loadDraftChanges,
  resolveScorecardSelector,
  type DraftChange,
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

/** Frozen, published scorecards only. Excludes the draft. */
export function listPublishedScorecards(): ScorecardManifest[] {
  return listScorecards().filter((c) => !isDraftScorecardVersion(c.version));
}

/** Current draft manifest, or null if no draft is registered. */
export function getDraftScorecard(): ScorecardManifest | null {
  return listScorecards().find((c) => isDraftScorecardVersion(c.version)) ?? null;
}

export function getDraftScorecardVersion(): string {
  return DRAFT_SCORECARD_VERSION;
}

export function getLatestScorecardVersion(): string {
  return LATEST_SCORECARD;
}

/** Re-exported so templates can branch on draft vs published without re-importing. */
export { isDraftScorecardVersion };

export function getScorecardByVersion(version: string): ResolvedScorecard {
  return getScorecard(resolveScorecardSelector(version));
}

export function getCheckSummariesForScorecard(version: string): CheckSummary[] {
  const scorecard = getScorecardByVersion(version);
  return [...scorecard.siteChecks, ...scorecard.pageChecks].map(toSummary);
}

export function getCheckSummary(version: string, id: string): CheckSummary | null {
  const scorecard = getScorecardByVersion(version);
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

/**
 * Structural diff between two scorecard manifests. Operates on the raw
 * `checks: Record<id, implVersion>` maps so it returns clean results even
 * when an id has since been removed from the registry. Order: added then
 * bumped then removed entries; ids within each bucket sorted alphabetically.
 */
export interface ScorecardDiff {
  fromVersion: string;
  toVersion: string;
  added: Array<{ id: string; toImpl: string }>;
  removed: Array<{ id: string; fromImpl: string }>;
  bumped: Array<{ id: string; fromImpl: string; toImpl: string }>;
}

function getManifestChecks(version: string): Record<string, string> {
  const resolved = resolveScorecardSelector(version);
  const manifest = listScorecards().find((c) => c.version === resolved);
  if (!manifest) {
    const known = listScorecards().map((c) => c.version).join(', ') || '(none)';
    throw new Error(
      `Unknown scorecard version "${version}". Known versions: ${known}`,
    );
  }
  return manifest.checks;
}

/**
 * Pure comparison of two check maps. Extracted so it can be exercised with
 * synthetic fixtures in tests without going through the real registry.
 */
export function diffCheckMaps(
  from: Record<string, string>,
  to: Record<string, string>,
): Pick<ScorecardDiff, 'added' | 'removed' | 'bumped'> {
  const added: ScorecardDiff['added'] = [];
  const removed: ScorecardDiff['removed'] = [];
  const bumped: ScorecardDiff['bumped'] = [];

  for (const [id, toImpl] of Object.entries(to)) {
    const fromImpl = from[id];
    if (fromImpl === undefined) {
      added.push({ id, toImpl });
    } else if (fromImpl !== toImpl) {
      bumped.push({ id, fromImpl, toImpl });
    }
  }
  for (const [id, fromImpl] of Object.entries(from)) {
    if (to[id] === undefined) {
      removed.push({ id, fromImpl });
    }
  }

  added.sort((a, b) => a.id.localeCompare(b.id));
  removed.sort((a, b) => a.id.localeCompare(b.id));
  bumped.sort((a, b) => a.id.localeCompare(b.id));

  return { added, removed, bumped };
}

export function diffScorecards(fromVersion: string, toVersion: string): ScorecardDiff {
  const from = getManifestChecks(fromVersion);
  const to = getManifestChecks(toVersion);
  return {
    fromVersion: resolveScorecardSelector(fromVersion),
    toVersion: resolveScorecardSelector(toVersion),
    ...diffCheckMaps(from, to),
  };
}

/**
 * Diff between the latest published scorecard and the current draft, joined
 * with attribution data from `draft-changes.json`. Entries with no matching
 * attribution record carry `attribution: null` (the most common case until
 * the refresh-draft-diff workflow records them post-merge).
 */
export interface DraftDiffEntry {
  id: string;
  kind: 'added' | 'removed' | 'bumped';
  fromImpl?: string;
  toImpl?: string;
  attribution: DraftChange | null;
}

export function getDraftDiff(): ScorecardDiff {
  return diffScorecards(LATEST_SCORECARD, DRAFT_SCORECARD_VERSION);
}

export function getDraftDiffEntries(): DraftDiffEntry[] {
  const diff = getDraftDiff();
  const attributions = loadDraftChanges().changes;
  const find = (id: string, kind: DraftDiffEntry['kind']): DraftChange | null =>
    attributions.find((c) => c.checkId === id && c.kind === kind) ?? null;

  return [
    ...diff.added.map((c): DraftDiffEntry => ({
      id: c.id,
      kind: 'added',
      toImpl: c.toImpl,
      attribution: find(c.id, 'added'),
    })),
    ...diff.bumped.map((c): DraftDiffEntry => ({
      id: c.id,
      kind: 'bumped',
      fromImpl: c.fromImpl,
      toImpl: c.toImpl,
      attribution: find(c.id, 'bumped'),
    })),
    ...diff.removed.map((c): DraftDiffEntry => ({
      id: c.id,
      kind: 'removed',
      fromImpl: c.fromImpl,
      attribution: find(c.id, 'removed'),
    })),
  ];
}
