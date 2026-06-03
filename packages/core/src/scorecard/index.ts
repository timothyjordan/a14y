import type {
  CheckContext,
  CheckOutcome,
  ResolvedCheck,
  ResolvedScorecard,
  ScorecardManifest,
  ScoringMethodology,
} from './types';
import { getCheck } from './registry';
import { SCORECARD_0_2_0 } from './v0_2';
import { SCORECARD_DRAFT } from './draft';
// Side-effect import: every check file registers itself with the registry
// as it loads. Must come after the `./registry` import so registerCheck
// has been initialised by the time the check files reference it.
import './_imports';

/**
 * Every scorecard version that has ever shipped, plus the in-progress
 * draft, keyed by semver. New scorecards are appended here as they are
 * released; the draft entry is rewritten in place each time it is cut.
 */
export const SCORECARDS: Record<string, ScorecardManifest> = {
  '0.2.0': SCORECARD_0_2_0,
  [SCORECARD_DRAFT.version]: SCORECARD_DRAFT,
};

/** Latest published (frozen) scorecard. Does not include the draft. */
export const LATEST_SCORECARD = '0.2.0';

/**
 * Version identifier of the current draft scorecard (e.g. `0.3.0-draft`).
 * Resolves to the same manifest as the literal `'draft'` alias accepted
 * by `getScorecard()`.
 */
export const DRAFT_SCORECARD_VERSION = SCORECARD_DRAFT.version;

/** True if the given scorecard version string is a draft (semver pre-release `-draft`). */
export function isDraftScorecardVersion(version: string): boolean {
  return version.endsWith('-draft');
}

/**
 * Every scoring methodology the runner knows how to dispatch on. Updated when
 * a new variant lands in `score/compute.ts`. Resolver uses this list to reject
 * manifests that pin an unknown methodology rather than silently scoring zero.
 */
const KNOWN_SCORING_METHODOLOGIES: readonly ScoringMethodology[] = [
  'flat-pool-v1',
  'per-check-mean-v1',
] as const;

function resolveScoringMethodology(manifest: ScorecardManifest): ScoringMethodology {
  const declared = manifest.scoringMethodology ?? 'flat-pool-v1';
  if (!KNOWN_SCORING_METHODOLOGIES.includes(declared)) {
    throw new Error(
      `Scorecard ${manifest.version} declares unknown scoringMethodology "${declared}". ` +
        `Known methodologies: ${KNOWN_SCORING_METHODOLOGIES.join(', ')}.`,
    );
  }
  return declared;
}

/**
 * Resolve `'draft'` (alias) and `'latest'` (alias) to concrete version
 * strings. Any other input is returned unchanged so explicit version
 * strings still hit the registry directly.
 */
export function resolveScorecardSelector(selector: string): string {
  if (selector === 'draft') return DRAFT_SCORECARD_VERSION;
  if (selector === 'latest') return LATEST_SCORECARD;
  return selector;
}

export function listScorecards(): ScorecardManifest[] {
  // Sort published scorecards lexicographically, then push drafts to the
  // end so consumers that iterate this list see stable rows first.
  const all = Object.values(SCORECARDS).slice().sort((a, b) => a.version.localeCompare(b.version));
  const published = all.filter((c) => !isDraftScorecardVersion(c.version));
  const drafts = all.filter((c) => isDraftScorecardVersion(c.version));
  return [...published, ...drafts];
}

/**
 * Look up and resolve a scorecard manifest into a runnable form. Throws a
 * loud, descriptive error if the manifest references any check id or
 * implementation version that isn't in the registry, so frozen scorecards
 * cannot silently drift.
 *
 * Accepts the literal aliases `'draft'` (current draft) and `'latest'`
 * (latest published) in addition to explicit version strings.
 */
export function getScorecard(version: string = LATEST_SCORECARD): ResolvedScorecard {
  const resolvedVersion = resolveScorecardSelector(version);
  const manifest = SCORECARDS[resolvedVersion];
  if (!manifest) {
    const known = Object.keys(SCORECARDS).join(', ') || '(none)';
    throw new Error(
      `Unknown scorecard version "${version}". Known versions: ${known}`,
    );
  }

  const siteChecks: ResolvedCheck[] = [];
  const pageChecks: ResolvedCheck[] = [];

  for (const [id, implVersion] of Object.entries(manifest.checks)) {
    const spec = getCheck(id);
    if (!spec) {
      throw new Error(
        `Scorecard ${manifest.version} references unknown check id "${id}". ` +
          `Make sure the check file is implemented and registered in scorecard/_imports.ts.`,
      );
    }
    const impl = spec.implementations[implVersion];
    if (!impl) {
      const available = Object.keys(spec.implementations).join(', ') || '(none)';
      throw new Error(
        `Scorecard ${manifest.version} pins check "${id}" to implementation ` +
          `version "${implVersion}", but only these implementations exist: ${available}`,
      );
    }

    const resolved: ResolvedCheck = {
      id: spec.id,
      scope: spec.scope,
      name: spec.name,
      group: spec.group,
      implementationVersion: impl.version,
      description: impl.description,
      phase: spec.scope === 'site' ? impl.phase : undefined,
      run: impl.run as (ctx: CheckContext) => Promise<CheckOutcome>,
    };

    if (spec.scope === 'site') siteChecks.push(resolved);
    else pageChecks.push(resolved);
  }

  return {
    version: manifest.version,
    releasedAt: manifest.releasedAt,
    description: manifest.description,
    scoringMethodology: resolveScoringMethodology(manifest),
    siteChecks,
    pageChecks,
  };
}

export * from './types';
export {
  loadDraftChanges,
  type DraftChange,
  type DraftChangeKind,
  type DraftChangesFile,
  type DraftCheckChange,
  type DraftMethodologyChange,
} from './draft-changes';
