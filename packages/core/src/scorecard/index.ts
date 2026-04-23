import type {
  CheckContext,
  CheckOutcome,
  ResolvedCheck,
  ResolvedScorecard,
  ScorecardManifest,
} from './types';
import { getCheck } from './registry';
import { SCORECARD_0_2_0 } from './v0_2';
// Side-effect import: every check file registers itself with the registry
// as it loads. Must come after the `./registry` import so registerCheck
// has been initialised by the time the check files reference it.
import './_imports';

/**
 * Every scorecard version that has ever shipped, keyed by semver. New
 * scorecards are appended here as they are released.
 */
export const SCORECARDS: Record<string, ScorecardManifest> = {
  '0.2.0': SCORECARD_0_2_0,
};

export const LATEST_SCORECARD = '0.2.0';

export function listScorecards(): ScorecardManifest[] {
  return Object.values(SCORECARDS).sort((a, b) => a.version.localeCompare(b.version));
}

/**
 * Look up and resolve a scorecard manifest into a runnable form. Throws a
 * loud, descriptive error if the manifest references any check id or
 * implementation version that isn't in the registry, so frozen scorecards
 * cannot silently drift.
 */
export function getScorecard(version: string = LATEST_SCORECARD): ResolvedScorecard {
  const manifest = SCORECARDS[version];
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
      run: impl.run as (ctx: CheckContext) => Promise<CheckOutcome>,
    };

    if (spec.scope === 'site') siteChecks.push(resolved);
    else pageChecks.push(resolved);
  }

  return {
    version: manifest.version,
    releasedAt: manifest.releasedAt,
    description: manifest.description,
    siteChecks,
    pageChecks,
  };
}

export * from './types';
