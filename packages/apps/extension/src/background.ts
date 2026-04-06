/// <reference types="chrome" />

import {
  LATEST_SCORECARD,
  validate,
  type ProgressEvent,
  type SiteRun,
} from '@agentready/core';
import type { RunRequest, RunResponse, RunStreamMessage } from './bridge';

/**
 * Single in-flight audit. The popup connects via chrome.runtime.connect to
 * receive streaming progress events; only one audit runs at a time per
 * extension instance to keep the service worker memory bounded.
 */
let inFlight: Promise<SiteRun> | null = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'agentready-run') return;

  port.onMessage.addListener(async (msg: RunRequest) => {
    if (msg.type !== 'run') return;
    if (inFlight) {
      port.postMessage({
        type: 'error',
        error: 'Another audit is already running. Wait for it to finish.',
      } satisfies RunStreamMessage);
      return;
    }

    const send = (m: RunStreamMessage) => {
      try {
        port.postMessage(m);
      } catch {
        // port disconnected; ignore
      }
    };

    const onProgress = (event: ProgressEvent) => send({ type: 'progress', event });

    inFlight = validate({
      url: msg.url,
      mode: msg.mode,
      scorecardVersion: msg.scorecardVersion ?? LATEST_SCORECARD,
      maxPages: msg.maxPages,
      concurrency: msg.concurrency,
      politeDelayMs: msg.politeDelayMs,
      onProgress,
    });

    try {
      const run = await inFlight;
      await persistRun(run);
      send({ type: 'done', run } satisfies RunStreamMessage);
    } catch (e) {
      send({ type: 'error', error: (e as Error).message });
    } finally {
      inFlight = null;
      port.disconnect();
    }
  });
});

// One-shot listener used by the results page to fetch the most recent run
// without re-running the audit.
chrome.runtime.onMessage.addListener((msg: RunRequest, _sender, sendResponse) => {
  if (msg.type !== 'get-recent-runs') return false;
  void getRecentRuns().then((runs) => {
    sendResponse({ type: 'recent-runs', runs } satisfies RunResponse);
  });
  return true; // keep the channel open for async response
});

const RUN_HISTORY_KEY = 'agentready:run-history';
const HISTORY_LIMIT = 20;

async function persistRun(run: SiteRun): Promise<void> {
  const history = await getRecentRuns();
  history.unshift({
    key: `${run.url}::${run.scorecardVersion}::${run.startedAt}`,
    run,
  });
  // Cap to keep storage small. Newest first.
  await chrome.storage.local.set({
    [RUN_HISTORY_KEY]: history.slice(0, HISTORY_LIMIT),
  });
}

async function getRecentRuns(): Promise<Array<{ key: string; run: SiteRun }>> {
  const data = await chrome.storage.local.get(RUN_HISTORY_KEY);
  return (data[RUN_HISTORY_KEY] as Array<{ key: string; run: SiteRun }>) ?? [];
}

// Mark service worker as alive on install for diagnostics.
chrome.runtime.onInstalled.addListener(() => {
  console.log(`agentready extension installed (scorecard ${LATEST_SCORECARD})`);
});
