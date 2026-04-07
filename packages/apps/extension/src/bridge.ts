import type { RunMode, SiteRun } from '@agentready/core';

/**
 * The popup, the results page, and the background SW all share state via
 * a single `chrome.storage.local` entry instead of a long-lived port.
 * Storage survives popup close and SW termination, which is exactly what
 * the popup needs to recover from a blur-induced close mid-audit.
 */
export const CURRENT_RUN_KEY = 'agentready:current-run';

export type RunStatus = 'idle' | 'running' | 'done' | 'error';

export interface CurrentRunState {
  status: RunStatus;
  url: string;
  mode: RunMode;
  scorecardVersion: string;
  /** Crawl knobs forwarded from the popup. The offscreen doc reads these
   * directly from the storage entry on load, so the background doesn't
   * have to send them in a separate message that could race with the
   * offscreen module finishing its initial load. */
  maxPages?: number;
  concurrency?: number;
  politeDelayMs?: number;
  /** ISO timestamp of when the audit was kicked off. */
  startedAt: string;
  /** ISO timestamp of the last progress write — used by stale detection. */
  lastProgressAt: string;
  progress: {
    /** Human-readable phase, e.g. "Visited 12 pages — /docs/foo". */
    phase: string;
    /** Pages discovered so far (0 in single-page mode). */
    visited: number;
    /** Best-effort percent (0..100). */
    pct: number;
  };
  /** Populated when status === 'done'. */
  result?: SiteRun;
  /** Populated when status === 'error'. */
  error?: string;
}

/**
 * One-shot wire format for popup → background. We deliberately do NOT use
 * chrome.runtime.connect any more: when the popup closes the port
 * disconnects, leaving the background's progress emitter shouting into a
 * void. Storage is the source of truth instead.
 */
export type RunRequest =
  | {
      type: 'start-run';
      url: string;
      mode: RunMode;
      scorecardVersion?: string;
      maxPages?: number;
      concurrency?: number;
      politeDelayMs?: number;
    }
  | { type: 'get-recent-runs' };

export type StartRunResponse =
  | { ok: true }
  | { ok: false; reason: 'busy'; message: string };

export type RunResponse = {
  type: 'recent-runs';
  runs: Array<{ key: string; run: SiteRun }>;
};

/** A run is considered stale if no progress event has landed within this window. */
export const STALE_PROGRESS_MS = 60_000;

/**
 * The background ↔ offscreen channel is intentionally NOT a runtime
 * message. The offscreen document reads `CURRENT_RUN_KEY` from
 * `chrome.storage.local` on load and starts the audit from whatever the
 * background already wrote. The background then watches storage with
 * `chrome.storage.onChanged` to learn when the offscreen doc has flipped
 * status to `done` or `error`, at which point it closes the document.
 *
 * This avoids the race where `chrome.runtime.sendMessage` is called
 * before the offscreen module's listener has registered — which silently
 * resolves with `undefined` and never delivers the run config.
 */
