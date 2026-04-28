/// <reference types="chrome" />

import { LATEST_SCORECARD, type SiteRun } from '@a14y/core';
import {
  bucketScore,
  bucketPageCount,
  bucketDurationMs,
  errorClassName,
} from '@a14y/telemetry';
import {
  CURRENT_RUN_KEY,
  STALE_PROGRESS_MS,
  type CurrentRunState,
  type OffscreenDoneMessage,
  type OffscreenErrorMessage,
  type OffscreenInbound,
  type OffscreenProgressMessage,
  type OffscreenReadyResponse,
  type RunRequest,
  type RunResponse,
  type StartRunResponse,
} from './bridge';
import { initExtensionTelemetry, track, flush } from './telemetry';

interface TelemetryMessage {
  type: 'telemetry-event';
  name: string;
  props?: Record<string, unknown>;
}

const RUN_HISTORY_KEY = 'a14y:run-history';
const HISTORY_LIMIT = 20;
const KEEPALIVE_ALARM = 'a14y-keepalive';
const KEEPALIVE_PERIOD_MIN = 0.4;

const OFFSCREEN_PATH = 'src/offscreen.html';
const OFFSCREEN_REASONS: chrome.offscreen.Reason[] = ['DOM_SCRAPING'];
const OFFSCREEN_JUSTIFICATION =
  'Run agent-readability audits in a long-lived HTML context so site crawls can outlast the service worker lifetime.';

// =========================================================================
// Message router
// =========================================================================

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Telemetry forwarder: any context can post a telemetry-event message;
  // the background is the only context that talks to the analytics endpoint.
  if ((msg as TelemetryMessage).type === 'telemetry-event') {
    const t = msg as TelemetryMessage;
    track(t.name, t.props ?? {});
    void flush();
    return false;
  }

  // Popup → background
  if ((msg as RunRequest).type === 'start-run') {
    void startRun(msg as RunRequest & { type: 'start-run' }).then((resp) => sendResponse(resp));
    return true; // async response
  }
  if ((msg as RunRequest).type === 'get-recent-runs') {
    void chrome.storage.local.get(RUN_HISTORY_KEY).then((data) => {
      sendResponse({
        type: 'recent-runs',
        runs: (data[RUN_HISTORY_KEY] as RunResponse['runs']) ?? [],
      } satisfies RunResponse);
    });
    return true;
  }

  // Offscreen → background
  if ((msg as OffscreenInbound).type === 'offscreen-ready') {
    void onOffscreenReady().then((resp) => sendResponse(resp));
    return true;
  }
  if ((msg as OffscreenInbound).type === 'offscreen-progress') {
    void onOffscreenProgress(msg as OffscreenProgressMessage);
    return false;
  }
  if ((msg as OffscreenInbound).type === 'offscreen-done') {
    void onOffscreenDone((msg as OffscreenDoneMessage).result);
    return false;
  }
  if ((msg as OffscreenInbound).type === 'offscreen-error') {
    void onOffscreenError((msg as OffscreenErrorMessage).error);
    return false;
  }
  return false;
});

// =========================================================================
// Run lifecycle (popup-initiated)
// =========================================================================

async function startRun(msg: RunRequest & { type: 'start-run' }): Promise<StartRunResponse> {
  const existing = await readCurrentRun();
  if (
    existing &&
    existing.status === 'running' &&
    Date.now() - new Date(existing.lastProgressAt).getTime() < STALE_PROGRESS_MS
  ) {
    return {
      ok: false,
      reason: 'busy',
      message: `An audit of ${existing.url} is already in progress.`,
    };
  }

  const now = new Date().toISOString();
  const initial: CurrentRunState = {
    status: 'running',
    url: msg.url,
    mode: msg.mode,
    scorecardVersion: msg.scorecardVersion ?? LATEST_SCORECARD,
    maxPages: msg.maxPages,
    concurrency: msg.concurrency,
    pageCheckConcurrency: msg.pageCheckConcurrency,
    politeDelayMs: msg.politeDelayMs,
    startedAt: now,
    lastProgressAt: now,
    progress: { phase: `Starting ${msg.mode} audit…`, visited: 0, pct: 0 },
  };
  await writeCurrentRun(initial);
  startKeepalive();

  track('ext_audit_started', {
    mode: msg.mode,
    scorecard_version: initial.scorecardVersion,
  });

  try {
    // Force a fresh module load every run by closing any prior offscreen
    // doc first. The offscreen module's main() only runs once per page
    // load, so reusing an existing doc would silently skip new runs.
    await closeOffscreenDocument();
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: OFFSCREEN_REASONS,
      justification: OFFSCREEN_JUSTIFICATION,
    });
  } catch (e) {
    await writeCurrentRun({
      ...initial,
      status: 'error',
      error: `Failed to start audit host: ${(e as Error).message}`,
      lastProgressAt: new Date().toISOString(),
    });
    stopKeepalive();
    track('ext_audit_error', { error_class: errorClassName(e), phase: 'start' });
    void flush();
  }

  return { ok: true };
}

// =========================================================================
// Offscreen → background handlers
// =========================================================================

async function onOffscreenReady(): Promise<OffscreenReadyResponse> {
  const state = await readCurrentRun();
  if (!state || state.status !== 'running') {
    return { ok: false, reason: 'no run pending' };
  }
  return {
    ok: true,
    config: {
      url: state.url,
      mode: state.mode,
      scorecardVersion: state.scorecardVersion,
      maxPages: state.maxPages,
      concurrency: state.concurrency,
      pageCheckConcurrency: state.pageCheckConcurrency,
      politeDelayMs: state.politeDelayMs,
    },
  };
}

async function onOffscreenProgress(msg: OffscreenProgressMessage): Promise<void> {
  const state = await readCurrentRun();
  if (!state) return;
  await writeCurrentRun({
    ...state,
    status: 'running',
    lastProgressAt: new Date().toISOString(),
    progress: { phase: msg.phase, visited: msg.visited, pct: msg.pct },
  });
}

async function onOffscreenDone(run: SiteRun): Promise<void> {
  const state = await readCurrentRun();
  const startedAt = state ? new Date(state.startedAt).getTime() : Date.now();
  if (state) {
    await writeCurrentRun({
      ...state,
      status: 'done',
      lastProgressAt: new Date().toISOString(),
      progress: {
        phase: `Score ${run.summary.score}`,
        visited: run.pages.length,
        pct: 100,
      },
      result: run,
    });
  }
  await persistRun(run);
  stopKeepalive();
  await closeOffscreenDocument();
  track('ext_audit_completed', {
    mode: state?.mode ?? 'page',
    scorecard_version: run.scorecardVersion,
    score_bucket: bucketScore(run.summary.score),
    page_count_bucket: bucketPageCount(run.pages.length),
    duration_ms_bucket: bucketDurationMs(Date.now() - startedAt),
  });
  await flush();
}

async function onOffscreenError(error: string): Promise<void> {
  const state = await readCurrentRun();
  if (state) {
    await writeCurrentRun({
      ...state,
      status: 'error',
      error,
      lastProgressAt: new Date().toISOString(),
    });
  }
  stopKeepalive();
  await closeOffscreenDocument();
  track('ext_audit_error', {
    error_class: typeof error === 'string' ? 'OffscreenError' : 'Error',
    phase: 'progress',
  });
  await flush();
}

// =========================================================================
// Offscreen document lifecycle
// =========================================================================

async function closeOffscreenDocument(): Promise<void> {
  try {
    const has = await chrome.offscreen.hasDocument();
    if (has) await chrome.offscreen.closeDocument();
  } catch {
    // Already closed; nothing to do.
  }
}

// =========================================================================
// Storage helpers
// =========================================================================

async function readCurrentRun(): Promise<CurrentRunState | null> {
  const data = await chrome.storage.local.get(CURRENT_RUN_KEY);
  return (data[CURRENT_RUN_KEY] as CurrentRunState | undefined) ?? null;
}

async function writeCurrentRun(state: CurrentRunState): Promise<void> {
  await chrome.storage.local.set({ [CURRENT_RUN_KEY]: state });
}

async function persistRun(run: SiteRun): Promise<void> {
  const data = await chrome.storage.local.get(RUN_HISTORY_KEY);
  const history = (data[RUN_HISTORY_KEY] as Array<{ key: string; run: SiteRun }>) ?? [];
  history.unshift({
    key: `${run.url}::${run.scorecardVersion}::${run.startedAt}`,
    run,
  });
  await chrome.storage.local.set({
    [RUN_HISTORY_KEY]: history.slice(0, HISTORY_LIMIT),
  });
}

// =========================================================================
// Keepalive
// =========================================================================

function startKeepalive(): void {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_PERIOD_MIN });
}

function stopKeepalive(): void {
  void chrome.alarms.clear(KEEPALIVE_ALARM);
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== KEEPALIVE_ALARM) return;
  void onKeepaliveTick();
});

async function onKeepaliveTick(): Promise<void> {
  // Touching storage counts as SW activity and resets the idle timer.
  const state = await readCurrentRun();
  if (state?.status !== 'running') return;
  // Watchdog: if the offscreen renderer was killed (typically by an OOM
  // on a very large site), no offscreen-done / offscreen-error message
  // will ever land. The popup would otherwise wait the full 60s before
  // falling back to the stale-banner. Detect the missing document and
  // surface a clear error within one alarm period (~24s).
  let hasDoc = false;
  try {
    hasDoc = await chrome.offscreen.hasDocument();
  } catch {
    hasDoc = false;
  }
  if (!hasDoc) {
    await writeCurrentRun({
      ...state,
      status: 'error',
      error:
        'Audit host crashed (renderer out of memory). Try a smaller --max-pages, or run the audit from the CLI for very large sites.',
      lastProgressAt: new Date().toISOString(),
    });
    stopKeepalive();
  }
}

// =========================================================================
// Stale-state recovery on extension startup / install
// =========================================================================

async function recoverStaleRunOnStartup(): Promise<void> {
  const existing = await readCurrentRun();
  if (!existing || existing.status !== 'running') return;
  const age = Date.now() - new Date(existing.lastProgressAt).getTime();
  if (age < STALE_PROGRESS_MS) return;
  await writeCurrentRun({
    ...existing,
    status: 'error',
    error: 'Audit interrupted (extension was restarted).',
    lastProgressAt: new Date().toISOString(),
  });
  stopKeepalive();
  await closeOffscreenDocument();
}

chrome.runtime.onStartup.addListener(() => {
  void recoverStaleRunOnStartup();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`a14y extension installed (scorecard ${LATEST_SCORECARD})`);
  void recoverStaleRunOnStartup();
  track('ext_installed', {
    reason: details.reason,
    previous_version: details.previousVersion,
  });
  void flush();
});

// Kick off telemetry as soon as the service worker boots. Init resolves
// fast (just reads chrome.storage.local), and any track() calls before
// init resolves are no-ops by design — the runtime hooks above all run
// asynchronously after init completes.
void initExtensionTelemetry();
