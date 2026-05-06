import type { SiteRun, CheckResult } from '@a14y/core';
import {
  rollupPageStatuses,
  trackScorecardCheckResult,
  type ScorecardCheckStatus,
  type TelemetrySurface,
} from '@a14y/telemetry';

export interface EmitScorecardChecksOptions {
  run: SiteRun;
  runId: string;
  surface: TelemetrySurface;
}

/**
 * Emit one `scorecard_check_result` event per check id in `run`. Site-level
 * checks pass through their status verbatim; page-level checks are rolled up
 * across pages (see `rollupPageStatuses`) so a single 100-page crawl produces
 * 38 events instead of 38×100. Returns the number of events emitted, mostly
 * for tests.
 */
export function emitScorecardChecks(opts: EmitScorecardChecksOptions): number {
  const { run, runId, surface } = opts;
  let count = 0;

  for (const check of run.siteChecks) {
    trackScorecardCheckResult({
      runId,
      checkId: check.id,
      status: check.status as ScorecardCheckStatus,
      scorecardVersion: run.scorecardVersion,
      surface,
    });
    count++;
  }

  // Group page-level results by stable check id, then roll up.
  const byCheckId = new Map<string, CheckResult[]>();
  for (const page of run.pages) {
    for (const check of page.checks) {
      const arr = byCheckId.get(check.id);
      if (arr) arr.push(check);
      else byCheckId.set(check.id, [check]);
    }
  }

  for (const [checkId, results] of byCheckId) {
    const rollup = rollupPageStatuses(results.map((r) => r.status as ScorecardCheckStatus));
    trackScorecardCheckResult({
      runId,
      checkId,
      status: rollup.status,
      scorecardVersion: run.scorecardVersion,
      surface,
      failedPages: rollup.failedPages,
      totalPages: rollup.totalPages,
    });
    count++;
  }

  return count;
}
