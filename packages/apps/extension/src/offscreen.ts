/// <reference types="chrome" />

import {
  validate,
  type ProgressEvent,
} from '@a14y/core';
import type {
  OffscreenDoneMessage,
  OffscreenErrorMessage,
  OffscreenProgressMessage,
  OffscreenReadyMessage,
  OffscreenReadyResponse,
} from './bridge';

/**
 * The offscreen document is the audit's actual host. It outlives the
 * service worker's 5-minute lifetime cap so even very long site crawls
 * can complete.
 *
 * Offscreen documents only get chrome.runtime / chrome.i18n / chrome.dom
 * — chrome.storage is NOT available — so this module cannot touch
 * chrome.storage.local at all. It talks to the background via runtime
 * messages, and the background owns every storage write.
 */

void main();

async function main(): Promise<void> {
  // Announce readiness AFTER this module has finished loading. The
  // background's reply (via sendResponse) carries the run config.
  let resp: OffscreenReadyResponse;
  try {
    resp = (await chrome.runtime.sendMessage({
      type: 'offscreen-ready',
    } satisfies OffscreenReadyMessage)) as OffscreenReadyResponse;
  } catch (e) {
    console.error('[agentready offscreen] failed to reach background:', e);
    return;
  }
  if (!resp || !resp.ok) {
    console.warn(
      '[agentready offscreen] background declined to start a run:',
      resp?.ok === false ? resp.reason : 'no response',
    );
    return;
  }

  const cfg = resp.config;

  // Throttle progress messages — chrome.storage has a write quota and
  // onProgress can fire dozens of times per second on a fast crawl.
  // Throttling on the SEND side means the background's storage write
  // count is naturally bounded.
  let pending: OffscreenProgressMessage = {
    type: 'offscreen-progress',
    phase: `Auditing ${cfg.url} (${cfg.mode})…`,
    visited: 0,
    pct: 0,
  };
  let lastFlush = 0;
  const FLUSH_MS = 250;

  const flush = (force = false) => {
    const now = Date.now();
    if (!force && now - lastFlush < FLUSH_MS) return;
    lastFlush = now;
    void chrome.runtime.sendMessage(pending).catch(() => {
      // SW may be temporarily asleep; the next progress event will
      // wake it. Best-effort delivery is fine because we always send
      // a final offscreen-done at the end.
    });
  };

  // Send the initial "Auditing started" snapshot so the popup sees the
  // doc came alive even before validate() emits its first event.
  flush(true);

  const onProgress = (event: ProgressEvent) => {
    switch (event.type) {
      case 'started':
        pending = { ...pending, phase: `Auditing (${event.mode})…` };
        break;
      case 'site-check-done':
        pending = { ...pending, phase: `Site check: ${event.result.id}` };
        break;
      case 'page-discovered':
        pending = {
          ...pending,
          visited: event.visited,
          phase: `Visited ${event.visited} pages — ${event.url}`,
          // Indeterminate-ish bar; the crawler doesn't know the total upfront.
          pct: Math.min(95, event.visited * 2),
        };
        break;
      case 'page-done':
        pending = {
          ...pending,
          phase: `Checked ${event.url} (${event.passed}/${event.total})`,
        };
        break;
      case 'finished':
        pending = { ...pending, phase: `Score ${event.summary.score}`, pct: 100 };
        break;
    }
    flush();
  };

  try {
    const run = await validate({
      url: cfg.url,
      mode: cfg.mode,
      scorecardVersion: cfg.scorecardVersion,
      maxPages: cfg.maxPages,
      concurrency: cfg.concurrency,
      politeDelayMs: cfg.politeDelayMs,
      onProgress,
    });
    flush(true);
    void chrome.runtime
      .sendMessage({ type: 'offscreen-done', result: run } satisfies OffscreenDoneMessage)
      .catch((e) => console.error('[agentready offscreen] failed to send done:', e));
  } catch (e) {
    void chrome.runtime
      .sendMessage({
        type: 'offscreen-error',
        error: (e as Error).message,
      } satisfies OffscreenErrorMessage)
      .catch((err) => console.error('[agentready offscreen] failed to send error:', err));
  }
}
