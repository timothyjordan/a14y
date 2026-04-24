/// <reference types="chrome" />

import { LATEST_SCORECARD, listScorecards, type RunMode, type SiteRun } from '@a14y/core';
import {
  CURRENT_RUN_KEY,
  STALE_PROGRESS_MS,
  type CurrentRunState,
  type RunRequest,
  type StartRunResponse,
} from './bridge';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const urlEl = $<HTMLElement>('current-url');
const scorecardEl = $<HTMLSelectElement>('scorecard');
const checkPageBtn = $<HTMLButtonElement>('check-page');
const checkSiteBtn = $<HTMLButtonElement>('check-site');
const progressEl = $<HTMLProgressElement>('progress');
const statusEl = $<HTMLElement>('status');
const resultEl = $<HTMLElement>('result');
const scoreEl = $<HTMLElement>('score');
const scoreMetaEl = $<HTMLElement>('score-meta');
const openResultsLink = $<HTMLAnchorElement>('open-results');

let activeTabUrl = '';

async function init() {
  for (const card of listScorecards()) {
    const opt = document.createElement('option');
    opt.value = card.version;
    opt.textContent = `v${card.version}` + (card.version === LATEST_SCORECARD ? ' (latest)' : '');
    scorecardEl.appendChild(opt);
  }
  scorecardEl.value = LATEST_SCORECARD;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabUrl = tab?.url ?? '';

  checkPageBtn.addEventListener('click', () => startRun('page'));
  checkSiteBtn.addEventListener('click', () => startRun('site'));
  openResultsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('src/results.html') });
  });

  // Render whatever the background last persisted, then keep the popup in
  // sync with storage so progress updates appear live AND a popup that's
  // reopened mid-audit immediately reflects the in-flight state.
  const initial = await readCurrentRun();
  render(initial);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!(CURRENT_RUN_KEY in changes)) return;
    render((changes[CURRENT_RUN_KEY].newValue ?? null) as CurrentRunState | null);
  });
}

async function readCurrentRun(): Promise<CurrentRunState | null> {
  const data = await chrome.storage.local.get(CURRENT_RUN_KEY);
  return (data[CURRENT_RUN_KEY] as CurrentRunState | undefined) ?? null;
}

function render(state: CurrentRunState | null) {
  // Always show the URL the popup is currently pointed at — either the
  // running audit's URL (so the user can see what's in flight) or the
  // active tab when idle.
  if (state && (state.status === 'running' || state.status === 'done')) {
    urlEl.textContent = state.url;
  } else {
    urlEl.textContent = activeTabUrl || '(no active tab)';
  }

  // Buttons need an active tab to start a new run.
  const canStart = !state || state.status === 'idle' || state.status === 'done' || state.status === 'error';
  const haveTab = activeTabUrl.length > 0;
  checkPageBtn.disabled = !canStart || !haveTab;
  checkSiteBtn.disabled = !canStart || !haveTab;

  if (!state || state.status === 'idle') {
    progressEl.hidden = true;
    resultEl.hidden = true;
    statusEl.textContent = '';
    statusEl.className = 'status';
    return;
  }

  if (state.status === 'running') {
    const stale = Date.now() - new Date(state.lastProgressAt).getTime() > STALE_PROGRESS_MS;
    if (stale) {
      // The SW probably died. Let the user retry without forcing them to
      // wait on a stuck progress bar.
      progressEl.hidden = true;
      resultEl.hidden = true;
      statusEl.className = 'status stale';
      statusEl.textContent = 'Audit may have stalled. Click a button above to retry.';
      checkPageBtn.disabled = !haveTab;
      checkSiteBtn.disabled = !haveTab;
      return;
    }
    progressEl.hidden = false;
    progressEl.value = state.progress.pct;
    resultEl.hidden = true;
    statusEl.className = 'status';
    statusEl.textContent = state.progress.phase;
    return;
  }

  if (state.status === 'done' && state.result) {
    progressEl.hidden = true;
    showResult(state.result);
    return;
  }

  if (state.status === 'error') {
    progressEl.hidden = true;
    resultEl.hidden = true;
    statusEl.className = 'status error';
    statusEl.textContent = `Error: ${state.error ?? 'unknown'}`;
    return;
  }
}

function showResult(run: SiteRun) {
  resultEl.hidden = false;
  scoreEl.textContent = `${run.summary.score}/100`;
  scoreEl.className = 'score-number ' + scoreClass(run.summary.score);
  scoreMetaEl.textContent = `Scorecard v${run.scorecardVersion} · ${run.summary.passed}/${run.summary.applicable} checks passed`;
  statusEl.className = 'status';
  statusEl.textContent = '';
}

function scoreClass(score: number): string {
  if (score >= 90) return 'good';
  if (score >= 70) return 'fair';
  return 'poor';
}

async function startRun(mode: RunMode) {
  if (!activeTabUrl) return;
  // Optimistically clear any prior result so the UI doesn't flash stale
  // data while waiting for the background to write its first running state.
  resultEl.hidden = true;
  statusEl.className = 'status';
  statusEl.textContent = `Starting ${mode} audit…`;
  progressEl.hidden = false;
  progressEl.value = 0;
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
    progressEl.hidden = true;
    checkPageBtn.disabled = !activeTabUrl;
    checkSiteBtn.disabled = !activeTabUrl;
  }
  // On success, the storage.onChanged listener will take over rendering
  // as the background writes progress updates.
}

void init();
