import type { SiteRun } from '@a14y/core';
import type { CurrentRunState } from '../bridge';
import { STALE_PROGRESS_MS } from '../bridge';

export type ViewMode =
  | 'progress'
  | 'stalled'
  | 'error'
  | 'report-current'
  | 'report-historical'
  | 'empty';

/**
 * Pure decision function: given the current `a14y:current-run` state
 * and the list of historical runs, decide which view the report page
 * should display. Extracted so it can be unit-tested without a DOM.
 *
 * Rules:
 *  - A running audit takes precedence over history (we want users
 *    landing here from the popup to see progress immediately).
 *  - A run that's been silent for `STALE_PROGRESS_MS` is treated as
 *    stalled — same UI as an error, with a retry hint.
 *  - A just-finished run shows its own result, even if older runs
 *    exist in history.
 *  - An errored run shows the error block; history is still listed
 *    below for context.
 *  - If nothing is in flight and nothing has ever run: empty state.
 */
export function decideView(
  state: CurrentRunState | null,
  history: SiteRun[],
  now: number = Date.now(),
): ViewMode {
  if (state) {
    if (state.status === 'running') {
      const last = Date.parse(state.lastProgressAt);
      if (!Number.isNaN(last) && now - last > STALE_PROGRESS_MS) return 'stalled';
      return 'progress';
    }
    if (state.status === 'error') return 'error';
    if (state.status === 'done' && state.result) return 'report-current';
  }
  if (history.length > 0) return 'report-historical';
  return 'empty';
}
