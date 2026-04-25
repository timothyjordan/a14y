/// <reference types="chrome" />

import { LATEST_SCORECARD, listScorecards, type RunMode } from '@a14y/core';
import {
  type RunRequest,
  type StartRunResponse,
} from './bridge';
import { attachThemeToggle } from './lib/theme';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const urlEl = $<HTMLElement>('current-url');
const scorecardEl = $<HTMLSelectElement>('scorecard');
const checkPageBtn = $<HTMLButtonElement>('check-page');
const checkSiteBtn = $<HTMLButtonElement>('check-site');
const statusEl = $<HTMLElement>('status');

let activeTabUrl = '';

async function init() {
  attachThemeToggle($<HTMLButtonElement>('theme-toggle'));

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

void init();
