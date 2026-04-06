import type { ProgressEvent, RunMode, SiteRun } from '@agentready/core';

/**
 * Wire format for the popup <-> background channel. Kept as a tagged union
 * so both ends can pattern-match on `type` without sharing class instances
 * (chrome.runtime serializes everything via structured clone).
 */
export type RunRequest =
  | {
      type: 'run';
      url: string;
      mode: RunMode;
      scorecardVersion?: string;
      maxPages?: number;
      concurrency?: number;
      politeDelayMs?: number;
    }
  | { type: 'get-recent-runs' };

export type RunStreamMessage =
  | { type: 'progress'; event: ProgressEvent }
  | { type: 'done'; run: SiteRun }
  | { type: 'error'; error: string };

export type RunResponse = {
  type: 'recent-runs';
  runs: Array<{ key: string; run: SiteRun }>;
};
