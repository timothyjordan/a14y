/// <reference types="chrome" />

import {
  LATEST_SCORECARD,
  validate,
  type ProgressEvent,
  type SiteRun,
} from '@agentready/core';
import {
  CURRENT_RUN_KEY,
  STALE_PROGRESS_MS,
  type CurrentRunState,
  type RunRequest,
  type RunResponse,
  type StartRunResponse,
} from './bridge';

const RUN_HISTORY_KEY = 'agentready:run-history';
const HISTORY_LIMIT = 20;
const KEEPALIVE_ALARM = 'agentready-keepalive';
/**
 * Service worker idle timeout is ~30s. Setting the alarm under that keeps
 * the SW from being terminated mid-audit, up to Chrome's hard 5min cap.
 * Anything longer needs an offscreen document — tracked as a follow-up.
 */
const KEEPALIVE_PERIOD_MIN = 0.4;

// =========================================================================
// Message router
// =========================================================================

chrome.runtime.onMessage.addListener((msg: RunRequest, _sender, sendResponse) => {
  if (msg.type === 'start-run') {
    void startRun(msg).then((resp) => sendResponse(resp));
    return true; // async response
  }
  if (msg.type === 'get-recent-runs') {
    void getRecentRuns().then((runs) => {
      sendResponse({ type: 'recent-runs', runs } satisfies RunResponse);
    });
    return true;
  }
  return false;
});

// =========================================================================
// Run lifecycle
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
    startedAt: now,
    lastProgressAt: now,
    progress: { phase: `Starting ${msg.mode} audit…`, visited: 0, pct: 0 },
  };
  await writeCurrentRun(initial);
  startKeepalive();

  // Run the audit in the background. We deliberately don't await it from
  // the message handler — sendResponse fires immediately so the popup can
  // close cleanly. The audit progresses through storage from here on.
  void runAuditToCompletion(msg, initial).catch(async (e) => {
    await writeCurrentRun({
      ...initial,
      status: 'error',
      error: (e as Error).message,
      lastProgressAt: new Date().toISOString(),
    });
    stopKeepalive();
  });

  return { ok: true };
}

async function runAuditToCompletion(
  msg: RunRequest & { type: 'start-run' },
  initial: CurrentRunState,
): Promise<void> {
  // Throttle progress writes — chrome.storage has a quota of ~120 writes/min
  // and onProgress can fire dozens of times per second on a fast crawl.
  let pendingPhase = initial.progress.phase;
  let pendingVisited = 0;
  let pendingPct = 0;
  let lastFlush = 0;
  const FLUSH_MS = 250;

  const flush = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFlush < FLUSH_MS) return;
    lastFlush = now;
    await writeCurrentRun({
      ...initial,
      status: 'running',
      lastProgressAt: new Date().toISOString(),
      progress: { phase: pendingPhase, visited: pendingVisited, pct: pendingPct },
    });
  };

  const onProgress = (event: ProgressEvent) => {
    switch (event.type) {
      case 'started':
        pendingPhase = `Auditing (${event.mode})…`;
        break;
      case 'site-check-done':
        pendingPhase = `Site check: ${event.result.id}`;
        break;
      case 'page-discovered':
        pendingVisited = event.visited;
        pendingPhase = `Visited ${event.visited} pages — ${event.url}`;
        // Indeterminate-ish bar; the crawler doesn't know the total upfront.
        pendingPct = Math.min(95, event.visited * 2);
        break;
      case 'page-done':
        pendingPhase = `Checked ${event.url} (${event.passed}/${event.total})`;
        break;
      case 'finished':
        pendingPct = 100;
        pendingPhase = `Score ${event.summary.score}`;
        break;
    }
    void flush();
  };

  try {
    const run = await validate({
      url: msg.url,
      mode: msg.mode,
      scorecardVersion: msg.scorecardVersion ?? LATEST_SCORECARD,
      maxPages: msg.maxPages,
      concurrency: msg.concurrency,
      politeDelayMs: msg.politeDelayMs,
      onProgress,
    });
    await flush(true);
    await persistRun(run);
    await writeCurrentRun({
      ...initial,
      status: 'done',
      lastProgressAt: new Date().toISOString(),
      progress: { phase: `Score ${run.summary.score}`, visited: run.pages.length, pct: 100 },
      result: run,
    });
  } finally {
    stopKeepalive();
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
  const history = await getRecentRuns();
  history.unshift({
    key: `${run.url}::${run.scorecardVersion}::${run.startedAt}`,
    run,
  });
  await chrome.storage.local.set({
    [RUN_HISTORY_KEY]: history.slice(0, HISTORY_LIMIT),
  });
}

async function getRecentRuns(): Promise<Array<{ key: string; run: SiteRun }>> {
  const data = await chrome.storage.local.get(RUN_HISTORY_KEY);
  return (data[RUN_HISTORY_KEY] as Array<{ key: string; run: SiteRun }>) ?? [];
}

// =========================================================================
// Keepalive: prevent the SW from being terminated mid-audit
// =========================================================================

function startKeepalive(): void {
  chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_PERIOD_MIN });
}

function stopKeepalive(): void {
  void chrome.alarms.clear(KEEPALIVE_ALARM);
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name !== KEEPALIVE_ALARM) return;
  // Touching storage is enough to count as activity and reset the SW idle
  // timer. The work itself is intentionally trivial.
  void chrome.storage.local.get(CURRENT_RUN_KEY);
});

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
}

chrome.runtime.onStartup.addListener(() => {
  void recoverStaleRunOnStartup();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log(`agentready extension installed (scorecard ${LATEST_SCORECARD})`);
  void recoverStaleRunOnStartup();
});
