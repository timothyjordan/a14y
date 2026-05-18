import type { CheckStatus, ScoringMethodology } from '../scorecard/types';

export interface CheckResult {
  id: string;
  name: string;
  group?: string;
  scope: 'site' | 'page';
  implementationVersion: string;
  status: CheckStatus;
  message?: string;
  details?: unknown;
  /** Link to the docs detail page for this check id in the scorecard version that
   *  produced the result. Populated by the runner so every renderer (JSON, HTML,
   *  markdown) sees it consistently. */
  docsUrl: string;
}

export interface ScoreSummary {
  /** Checks that returned `pass`. */
  passed: number;
  /** Checks that returned `fail`. */
  failed: number;
  /** Checks that returned `warn`. */
  warned: number;
  /** Checks that errored unexpectedly. */
  errored: number;
  /** Checks that returned `na` and are excluded from scoring. */
  na: number;
  /** Total checks evaluated (passed + failed + warned + errored + na). */
  total: number;
  /** Checks that count toward the score (total - na). */
  applicable: number;
  /** Final score 0-100, computed as round(passed / applicable * 100). */
  score: number;
}

/**
 * Aggregate any number of check results into a single ScoreSummary.
 *
 * The pass/fail/warn/error/na counts are methodology-independent — they
 * always reflect what each check returned. The headline `score` is computed
 * by `computeScore()` according to the scorecard's pinned methodology, so
 * different scorecards can adopt different aggregation rules without
 * silently changing the scores of consumers pinned to an older scorecard.
 *
 * The `methodology` parameter defaults to `'flat-pool-v1'` for backwards
 * compatibility with callers that don't know about scorecard methodology
 * (e.g. ad-hoc test fixtures); the runner always passes the scorecard's
 * declared methodology explicitly.
 */
export function summarize(
  results: CheckResult[],
  methodology: ScoringMethodology = 'flat-pool-v1',
): ScoreSummary {
  let passed = 0;
  let failed = 0;
  let warned = 0;
  let errored = 0;
  let na = 0;
  for (const r of results) {
    switch (r.status) {
      case 'pass':
        passed++;
        break;
      case 'fail':
        failed++;
        break;
      case 'warn':
        warned++;
        break;
      case 'error':
        errored++;
        break;
      case 'na':
        na++;
        break;
    }
  }
  const total = results.length;
  const applicable = total - na;
  const score = computeScore({ results, passed, applicable, methodology });
  return { passed, failed, warned, errored, na, total, applicable, score };
}

interface ComputeScoreInput {
  results: CheckResult[];
  passed: number;
  applicable: number;
  methodology: ScoringMethodology;
}

/**
 * Dispatch the headline score on the scorecard's pinned methodology.
 * Each branch is the frozen scoring algorithm for that methodology id;
 * adding a new methodology means a new branch here plus a new entry in
 * `KNOWN_SCORING_METHODOLOGIES` in `scorecard/index.ts`.
 */
function computeScore({ passed, applicable, methodology }: ComputeScoreInput): number {
  switch (methodology) {
    case 'flat-pool-v1':
      return applicable === 0 ? 0 : Math.round((passed / applicable) * 100);
    default: {
      // Compile-time exhaustiveness: if a new methodology id is added to
      // ScoringMethodology without a matching case here, TypeScript flags
      // this assignment as the only branch where `methodology` is not
      // `never`. The runtime throw is defense-in-depth in case the type
      // is widened in test code.
      const _exhaustive: never = methodology;
      throw new Error(`Unknown scoringMethodology: ${String(_exhaustive)}`);
    }
  }
}
