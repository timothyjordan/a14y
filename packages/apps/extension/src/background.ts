/// <reference types="chrome" />

import { LATEST_SCORECARD } from '@agentready/core';
import {
  CURRENT_RUN_KEY,
  STALE_PROGRESS_MS,
  type CurrentRunState,
  type OffscreenResultMessage,
  type OffscreenRunMessage,
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
// Message router
// =========================================================================

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Popup → background
  if ((msg as RunRequest).type === 'start-run') {
    void startRun(msg as RunRequest & { type: 'start-run' }).then((resp) => sendResponse(resp));
    return true; // async response
  }
  if ((msg as RunRequest).type === 'get-recent-runs') {
    void chrome.storage.local.get('agentready:run-history').then((data) => {
      sendResponse({
        type: 'recent-runs',
        runs: (data['agentready:run-history'] as RunResponse['runs']) ?? [],
      } satisfies RunResponse);
    });
    return true;
  }
  // Offscreen → background
  if ((msg as OffscreenResultMessage).type === 'offscreen-done') {
    void onOffscreenFinished();
    return false;
  }
  if ((msg as OffscreenResultMessage).type === 'offscreen-error') {
    void onOffscreenError((msg as { error: string }).error);
    return false;
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

  try {
    await ensureOffscreenDocument();
    const offscreenMsg: OffscreenRunMessage = {
      type: 'offscreen-run',
      url: msg.url,
      mode: msg.mode,
      scorecardVersion: initial.scorecardVersion,
      maxPages: msg.maxPages,
      concurrency: msg.concurrency,
      politeDelayMs: msg.politeDelayMs,
      initial,
    };
    // Fire-and-forget. Progress lands in chrome.storage; completion or
    // error comes back via the offscreen-done / offscreen-error router
    // above. We deliberately don't await the audit here so the SW can
    // sleep between progress events without holding a long Promise.
    void chrome.runtime.sendMessage(offscreenMsg).catch(async (e) => {
      await onOffscreenError(`Failed to dispatch audit: ${(e as Error).message}`);
    });
  } catch (e) {
    await onOffscreenError((e as Error).message);
  }

  return { ok: true };
}

async function onOffscreenFinished(): Promise<void> {
  // Storage was already updated to status='done' by the offscreen doc.
  stopKeepalive();
  await closeOffscreenDocument();
}

async function onOffscreenError(error: string): Promise<void> {
  const existing = await readCurrentRun();
  if (existing) {
    await writeCurrentRun({
      ...existing,
      status: 'error',
      error,
      lastProgressAt: new Date().toISOString(),
    });
  }
  stopKeepalive();
  await closeOffscreenDocument();
}

// =========================================================================
// Offscreen document lifecycle
// =========================================================================

async function ensureOffscreenDocument(): Promise<void> {
  // chrome.offscreen.hasDocument() returns boolean; older Chrome versions
  // expose it as a Promise. We support both.
  const has = await chrome.offscreen.hasDocument();
  if (has) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: OFFSCREEN_REASONS,
    justification: OFFSCREEN_JUSTIFICATION,
  });
}

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
// Keepalive: keep the SW awake while the offscreen doc is auditing
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
  // final offscreen-done message; the audit itself runs in the offscreen
  // doc and is not bound by the SW lifetime.
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
