import type { CheckStatus } from '../scorecard/types';

export interface CheckResult {
  id: string;
  name: string;
  group?: string;
  scope: 'site' | 'page';
  implementationVersion: string;
  status: CheckStatus;
  message?: string;
  details?: unknown;
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
 * Aggregate any number of check results into a single ScoreSummary. The
 * formula matches the agent readability spec: only `pass` counts toward
 * the numerator, only non-`na` checks count toward the denominator.
 */
export function summarize(results: CheckResult[]): ScoreSummary {
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
  const score = applicable === 0 ? 0 : Math.round((passed / applicable) * 100);
  return { passed, failed, warned, errored, na, total, applicable, score };
}
