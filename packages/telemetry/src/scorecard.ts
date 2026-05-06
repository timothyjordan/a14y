import { track } from './core/tracker';

export type ScorecardCheckStatus = 'pass' | 'fail' | 'warn' | 'error' | 'na';
export type TelemetrySurface = 'cli' | 'ext';

const HEX = '0123456789abcdef';

/**
 * Generate a per-run identifier. 8 hex chars (32 bits) is plenty — runs are
 * scoped to a single GA4 property and at any realistic volume the collision
 * probability inside a query window is negligible. We deliberately keep it
 * short so the GA4 param-length budget stays generous for other dimensions.
 */
export function generateRunId(): string {
  const bytes = new Uint8Array(4);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += HEX[(bytes[i] >> 4) & 0xf] + HEX[bytes[i] & 0xf];
  }
  return out;
}

export interface PageStatusRollup {
  status: ScorecardCheckStatus;
  failedPages: number;
  totalPages: number;
}

/**
 * Roll up a page-level check's per-page outcomes into one run-level outcome.
 * Precedence is fail > error > warn > pass > na: any page failing wins, then
 * any page erroring, etc. `na` only wins when every page returned `na`. The
 * returned shape also exposes failed_pages / total_pages so analytics can
 * distinguish "1 of 50 pages failed" from "all 50 failed".
 */
export function rollupPageStatuses(statuses: ScorecardCheckStatus[]): PageStatusRollup {
  let failed = 0;
  let errored = 0;
  let warned = 0;
  let passed = 0;
  for (const s of statuses) {
    if (s === 'fail') failed++;
    else if (s === 'error') errored++;
    else if (s === 'warn') warned++;
    else if (s === 'pass') passed++;
  }
  let status: ScorecardCheckStatus;
  if (failed > 0) status = 'fail';
  else if (errored > 0) status = 'error';
  else if (warned > 0) status = 'warn';
  else if (passed > 0) status = 'pass';
  else status = 'na';
  return { status, failedPages: failed, totalPages: statuses.length };
}

export interface ScorecardCheckResultParams {
  runId: string;
  checkId: string;
  status: ScorecardCheckStatus;
  scorecardVersion: string;
  surface: TelemetrySurface;
  /** Page-level checks: number of pages that returned `fail`. */
  failedPages?: number;
  /** Page-level checks: total number of pages this check ran against. */
  totalPages?: number;
}

/**
 * Emit one `scorecard_check_result` event. Wraps the underlying tracker so
 * callers don't reach for the GA4 event name directly and so the payload
 * shape is type-checked.
 */
export function trackScorecardCheckResult(p: ScorecardCheckResultParams): void {
  const params: Record<string, unknown> = {
    run_id: p.runId,
    check_id: p.checkId,
    status: p.status,
    scorecard_version: p.scorecardVersion,
    surface: p.surface,
  };
  if (typeof p.failedPages === 'number') params.failed_pages = p.failedPages;
  if (typeof p.totalPages === 'number') params.total_pages = p.totalPages;
  track('scorecard_check_result', params);
}
