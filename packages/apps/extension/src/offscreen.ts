/// <reference types="chrome" />

import {
  validate,
  type ProgressEvent,
  type SiteRun,
} from '@agentready/core';
import {
  CURRENT_RUN_KEY,
  type CurrentRunState,
  type OffscreenResultMessage,
  type OffscreenRunMessage,
} from './bridge';

const RUN_HISTORY_KEY = 'agentready:run-history';
const HISTORY_LIMIT = 20;

/**
 * The offscreen document is the audit's actual host. It receives an
 * `offscreen-run` message from the background SW, runs `validate()` to
 * completion (which can take many minutes for a large site), writes
 * progress to chrome.storage.local as it goes, and then notifies the
 * background to close the document.
 *
 * The popup keeps reading chrome.storage.local exactly as before; it
 * doesn't know whether the work is happening in the SW or here.
 */
chrome.runtime.onMessage.addListener((msg: OffscreenRunMessage, _sender, sendResponse) => {
  if (msg.type !== 'offscreen-run') return false;
  void runHere(msg)
    .then(() => {
      reply({ type: 'offscreen-done' });
    })
    .catch((e) => {
      reply({ type: 'offscreen-error', error: (e as Error).message });
    });
  // Acknowledge synchronously; the result is delivered via reply() above.
  sendResponse({ ok: true });
  return false;
});

function reply(msg: OffscreenResultMessage): void {
  void chrome.runtime.sendMessage(msg).catch(() => {
    // The background may already be tearing us down; ignore.
  });
}

async function runHere(msg: OffscreenRunMessage): Promise<void> {
  // Throttle progress writes — chrome.storage has a write quota and
  // onProgress can fire dozens of times per second on a fast crawl.
  let pendingPhase = msg.initial.progress.phase;
  let pendingVisited = 0;
  let pendingPct = 0;
  let lastFlush = 0;
  const FLUSH_MS = 250;

  const flush = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFlush < FLUSH_MS) return;
    lastFlush = now;
    const next: CurrentRunState = {
      ...msg.initial,
      status: 'running',
      lastProgressAt: new Date().toISOString(),
      progress: { phase: pendingPhase, visited: pendingVisited, pct: pendingPct },
    };
    await chrome.storage.local.set({ [CURRENT_RUN_KEY]: next });
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

  const run = await validate({
    url: msg.url,
    mode: msg.mode,
    scorecardVersion: msg.scorecardVersion,
    maxPages: msg.maxPages,
    concurrency: msg.concurrency,
    politeDelayMs: msg.politeDelayMs,
    onProgress,
  });

  await flush(true);
  await persistRun(run);

  const done: CurrentRunState = {
    ...msg.initial,
    status: 'done',
    lastProgressAt: new Date().toISOString(),
    progress: { phase: `Score ${run.summary.score}`, visited: run.pages.length, pct: 100 },
    result: run,
  };
  await chrome.storage.local.set({ [CURRENT_RUN_KEY]: done });
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
