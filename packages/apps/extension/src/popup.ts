/// <reference types="chrome" />

import { LATEST_SCORECARD, listScorecards, type RunMode } from '@a14y/core';
import {
  type RunRequest,
  type StartRunResponse,
} from './bridge';
import { attachThemeToggle } from './lib/theme';

const SETTINGS_KEY = 'a14y:settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const urlEl = $<HTMLElement>('current-url');
const scorecardEl = $<HTMLSelectElement>('scorecard');
const checkPageBtn = $<HTMLButtonElement>('check-page');
const checkSiteBtn = $<HTMLButtonElement>('check-site');
const statusEl = $<HTMLElement>('status');
const banner = $<HTMLElement>('telemetry-banner');
const bannerDismiss = $<HTMLButtonElement>('telemetry-banner-dismiss');
const bannerDisable = $<HTMLButtonElement>('telemetry-banner-disable');

let activeTabUrl = '';

async function init() {
  attachThemeToggle($<HTMLButtonElement>('theme-toggle'));
  await initTelemetryBanner();

  for (const card of listScorecards()) {
    const opt = document.createElement('option');
    opt.value = card.version;
    opt.textContent = `v${card.version}` + (card.version === LATEST_SCORECARD ? ' (latest)' : '');
    scorecardEl.appendChild(opt);
  }
  scorecardEl.value = LATEST_SCORECARD;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabUrl = tab?.url ?? '';
  urlEl.textContent = activeTabUrl || '(no active tab)';

  const haveTab = activeTabUrl.length > 0;
  checkPageBtn.disabled = !haveTab;
  checkSiteBtn.disabled = !haveTab;

  checkPageBtn.addEventListener('click', () => startRun('page'));
  checkSiteBtn.addEventListener('click', () => startRun('site'));
}

async function startRun(mode: RunMode) {
  if (!activeTabUrl) return;
  // Optimistic feedback in case the background takes a beat. Once the run
  // actually starts we'll redirect to the dedicated results tab and close
  // the popup, so this status line is only briefly visible.
  statusEl.className = 'status';
  statusEl.textContent = `Starting ${mode} audit…`;
  checkPageBtn.disabled = true;
  checkSiteBtn.disabled = true;

  const req: RunRequest = {
    type: 'start-run',
    url: activeTabUrl,
    mode,
    scorecardVersion: scorecardEl.value,
  };
  const resp = (await chrome.runtime.sendMessage(req)) as StartRunResponse;
  if (!resp.ok) {
    statusEl.className = 'status error';
    statusEl.textContent = resp.message;
    checkPageBtn.disabled = false;
    checkSiteBtn.disabled = false;
    return;
  }

  // Success: hand the user off to the results tab. The results page reads
  // the same `a14y:current-run` storage entry the background just wrote,
  // so it picks up the live progress immediately.
  await chrome.tabs.create({ url: chrome.runtime.getURL('src/results.html') });
  window.close();
}

async function initTelemetryBanner(): Promise<void> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = (data[SETTINGS_KEY] as { telemetryNoticeShown?: boolean; telemetryEnabled?: boolean } | undefined) ?? {};
  if (settings.telemetryNoticeShown === true || settings.telemetryEnabled === false) return;
  banner.hidden = false;
  bannerDismiss.addEventListener('click', () => {
    void persistNoticeShown();
    banner.hidden = true;
  });
  bannerDisable.addEventListener('click', () => {
    void persistTelemetryDisabled();
    banner.hidden = true;
  });
}

async function persistNoticeShown(): Promise<void> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = (data[SETTINGS_KEY] as Record<string, unknown> | undefined) ?? {};
  await chrome.storage.local.set({
    [SETTINGS_KEY]: { ...settings, telemetryNoticeShown: true },
  });
}

async function persistTelemetryDisabled(): Promise<void> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = (data[SETTINGS_KEY] as Record<string, unknown> | undefined) ?? {};
  await chrome.storage.local.set({
    [SETTINGS_KEY]: { ...settings, telemetryEnabled: false, telemetryNoticeShown: true },
  });
}

void init();
