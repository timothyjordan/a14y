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
 * Wire format for the background ↔ offscreen channel. The offscreen
 * document hosts the actual `validate()` call so audits can outlast the
 * service worker's 5-minute lifetime cap. Distinct message `type` values
 * keep these from being confused with the popup → background protocol —
 * `chrome.runtime.sendMessage` broadcasts to every extension context.
 */
export interface OffscreenRunMessage {
  type: 'offscreen-run';
  url: string;
  mode: RunMode;
  scorecardVersion: string;
  maxPages?: number;
  concurrency?: number;
  politeDelayMs?: number;
  /** Snapshot of the storage state the background already initialised. */
  initial: CurrentRunState;
}

export type OffscreenResultMessage =
  | { type: 'offscreen-done' }
  | { type: 'offscreen-error'; error: string };
