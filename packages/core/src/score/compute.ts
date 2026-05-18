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
function computeScore({ results, passed, applicable, methodology }: ComputeScoreInput): number {
  switch (methodology) {
    case 'flat-pool-v1':
      return applicable === 0 ? 0 : Math.round((passed / applicable) * 100);
    case 'per-check-mean-v1':
      return perCheckMeanScore(results);
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

/**
 * Implementation of the `per-check-mean-v1` scoring methodology.
 *
 *   score = round(mean({ passed / applicable for each check_id where applicable > 0 }))
 *
 * Each distinct `check_id` contributes one observation regardless of how many
 * pages it fires on, so site-wide signals don't get diluted as page count
 * grows (the bug in `flat-pool-v1`). For 1-page audits this is identical to
 * `flat-pool-v1`; for site-mode audits inflated cap-hit scores come down
 * toward a more representative number.
 *
 * `na` firings are dropped entirely (no observation contributed). A check id
 * that returns `na` on every firing does not pull the mean toward zero — it
 * was simply never applicable to this site. If no check id has any
 * applicable firing, the score is `0` (matches flat-pool's "no signal"
 * semantics).
 *
 * See `/scorecards/#scoring-methodology` for the docs spec and motivating
 * example. Pinned by the v0.3.0-draft scorecard and immutable once cut.
 */
function perCheckMeanScore(results: CheckResult[]): number {
  const byCheck = new Map<string, { passed: number; applicable: number }>();
  for (const r of results) {
    if (r.status === 'na') continue;
    const cur = byCheck.get(r.id) ?? { passed: 0, applicable: 0 };
    cur.applicable += 1;
    if (r.status === 'pass') cur.passed += 1;
    byCheck.set(r.id, cur);
  }
  if (byCheck.size === 0) return 0;
  let sum = 0;
  for (const { passed, applicable } of byCheck.values()) {
    sum += (passed / applicable) * 100;
  }
  return Math.round(sum / byCheck.size);
}
