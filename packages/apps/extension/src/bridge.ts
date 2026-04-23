import type { RunMode, SiteRun } from '@a14y/core';

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
  /** Crawl knobs forwarded from the popup. */
  maxPages?: number;
  concurrency?: number;
  /** Bounded fan-out for per-page checks; smaller values cap peak
   * memory in the offscreen renderer on large site audits. */
  pageCheckConcurrency?: number;
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
      pageCheckConcurrency?: number;
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
 * Wire format for the background ↔ offscreen channel.
 *
 * Offscreen documents in MV3 only get a small subset of chrome.* APIs
 * (chrome.runtime, chrome.i18n, chrome.dom). chrome.storage is NOT
 * available, so the offscreen doc CANNOT touch chrome.storage.local
 * directly — every progress write has to be relayed through the
 * background SW.
 *
 * The race that bit us in TJ-119 (background sending a message to the
 * offscreen doc before its listener was registered) is solved by
 * inverting the direction: the offscreen doc sends `offscreen-ready`
 * AFTER registering its own listener, and the background returns the
 * run config in the response. The offscreen doc then drives the rest of
 * the conversation, so every message it sends necessarily originates
 * from a context where the background SW is already alive (the SW is
 * woken up by the previous incoming message).
 */
export interface OffscreenReadyMessage {
  type: 'offscreen-ready';
}

export interface OffscreenRunConfig {
  url: string;
  mode: RunMode;
  scorecardVersion: string;
  maxPages?: number;
  concurrency?: number;
  pageCheckConcurrency?: number;
  politeDelayMs?: number;
}

export type OffscreenReadyResponse =
  | { ok: true; config: OffscreenRunConfig }
  | { ok: false; reason: string };

export interface OffscreenProgressMessage {
  type: 'offscreen-progress';
  /** Phase string the popup will display verbatim. */
  phase: string;
  /** Pages discovered so far (0 in single-page mode). */
  visited: number;
  /** Best-effort percent (0..100). */
  pct: number;
}

export interface OffscreenDoneMessage {
  type: 'offscreen-done';
  result: SiteRun;
}

export interface OffscreenErrorMessage {
  type: 'offscreen-error';
  error: string;
}

export type OffscreenInbound =
  | OffscreenReadyMessage
  | OffscreenProgressMessage
  | OffscreenDoneMessage
  | OffscreenErrorMessage;
