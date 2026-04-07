/// <reference types="chrome" />

import { LATEST_SCORECARD } from '@agentready/core';
import {
  CURRENT_RUN_KEY,
  STALE_PROGRESS_MS,
  type CurrentRunState,
  type RunRequest,
  type RunResponse,
  type StartRunResponse,
} from './bridge';

const KEEPALIVE_ALARM = 'agentready-keepalive';
const KEEPALIVE_PERIOD_MIN = 0.4;

const OFFSCREEN_PATH = 'src/offscreen.html';
const OFFSCREEN_REASONS: chrome.offscreen.Reason[] = ['DOM_SCRAPING'];
const OFFSCREEN_JUSTIFICATION =
  'Run agent-readability audits in a long-lived HTML context so site crawls can outlast the service worker lifetime.';

// =========================================================================
// Message router (popup → background)
// =========================================================================

chrome.runtime.onMessage.addListener((msg: RunRequest, _sender, sendResponse) => {
  if (msg.type === 'start-run') {
    void startRun(msg).then((resp) => sendResponse(resp));
    return true; // async response
  }
  if (msg.type === 'get-recent-runs') {
    void chrome.storage.local.get('agentready:run-history').then((data) => {
      sendResponse({
        type: 'recent-runs',
        runs: (data['agentready:run-history'] as RunResponse['runs']) ?? [],
      } satisfies RunResponse);
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
    maxPages: msg.maxPages,
    concurrency: msg.concurrency,
    politeDelayMs: msg.politeDelayMs,
    startedAt: now,
    lastProgressAt: now,
    progress: { phase: `Starting ${msg.mode} audit…`, visited: 0, pct: 0 },
  };
  // The storage entry IS the message to the offscreen document. It MUST be
  // written before the document is created, because the document reads
  // CURRENT_RUN_KEY in its module's top-level main() function.
  await writeCurrentRun(initial);
  startKeepalive();

  try {
    // Force a fresh module load every run by closing any prior offscreen
    // doc first. The offscreen entrypoint only runs once per page load,
    // so reusing an existing doc would silently skip new runs.
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
  }

  return { ok: true };
}

// =========================================================================
// Storage watcher: closes the offscreen doc when the audit finishes
// =========================================================================

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const change = changes[CURRENT_RUN_KEY];
  if (!change) return;
  const next = change.newValue as CurrentRunState | undefined;
  if (!next) return;
  if (next.status === 'done' || next.status === 'error') {
    void onAuditFinished();
  }
});

async function onAuditFinished(): Promise<void> {
  stopKeepalive();
  await closeOffscreenDocument();
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

// =========================================================================
// Keepalive: keep the SW awake long enough to receive the storage events
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
  // timer. The SW only needs to stay awake long enough to receive the
  // storage event that flips status away from 'running'; the audit itself
  // runs in the offscreen doc and is not bound by the SW lifetime.
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
  await closeOffscreenDocument();
}

chrome.runtime.onStartup.addListener(() => {
  void recoverStaleRunOnStartup();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log(`agentready extension installed (scorecard ${LATEST_SCORECARD})`);
  void recoverStaleRunOnStartup();
});
