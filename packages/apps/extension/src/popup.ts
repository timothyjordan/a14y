/// <reference types="chrome" />

import { LATEST_SCORECARD, listScorecards, type RunMode, type SiteRun } from '@agentready/core';
import type { RunRequest, RunStreamMessage } from './bridge';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const urlEl = $<HTMLElement>('current-url');
const scorecardEl = $<HTMLSelectElement>('scorecard');
const checkPageBtn = $<HTMLButtonElement>('check-page');
const checkSiteBtn = $<HTMLButtonElement>('check-site');
const progressEl = $<HTMLProgressElement>('progress');
const statusEl = $<HTMLElement>('status');
const resultEl = $<HTMLElement>('result');
const scoreEl = $<HTMLElement>('score');
const openResultsLink = $<HTMLAnchorElement>('open-results');

let currentUrl = '';
let lastRun: SiteRun | null = null;

async function init() {
  for (const card of listScorecards()) {
    const opt = document.createElement('option');
    opt.value = card.version;
    opt.textContent = `v${card.version}` + (card.version === LATEST_SCORECARD ? ' (latest)' : '');
    scorecardEl.appendChild(opt);
  }
  scorecardEl.value = LATEST_SCORECARD;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url ?? '';
  urlEl.textContent = currentUrl || '(no active tab)';
  if (!currentUrl) {
    checkPageBtn.disabled = true;
    checkSiteBtn.disabled = true;
  }

  checkPageBtn.addEventListener('click', () => runAudit('page'));
  checkSiteBtn.addEventListener('click', () => runAudit('site'));
  openResultsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('src/results.html') });
  });
}

function runAudit(mode: RunMode) {
  if (!currentUrl) return;
  setBusy(true);
  resultEl.hidden = true;
  lastRun = null;
  statusEl.textContent = `Starting ${mode} audit…`;
  progressEl.hidden = false;
  progressEl.value = 0;

  const port = chrome.runtime.connect({ name: 'agentready-run' });
  port.postMessage({
    type: 'run',
    url: currentUrl,
    mode,
    scorecardVersion: scorecardEl.value,
  } satisfies RunRequest);

  let pagesSeen = 0;
  port.onMessage.addListener((msg: RunStreamMessage) => {
    if (msg.type === 'progress') {
      const e = msg.event;
      if (e.type === 'started') statusEl.textContent = `Auditing (${e.mode})…`;
      else if (e.type === 'site-check-done') statusEl.textContent = `Site check: ${e.result.id}`;
      else if (e.type === 'page-discovered') {
        pagesSeen = e.visited;
        statusEl.textContent = `Visited ${pagesSeen} pages — ${e.url}`;
        // Indeterminate-ish progress: nudge the bar.
        progressEl.value = Math.min(95, pagesSeen * 2);
      } else if (e.type === 'page-done') {
        statusEl.textContent = `Checked ${e.url} (${e.passed}/${e.total})`;
      } else if (e.type === 'finished') {
        progressEl.value = 100;
      }
    } else if (msg.type === 'done') {
      lastRun = msg.run;
      showResult(msg.run);
      setBusy(false);
    } else if (msg.type === 'error') {
      statusEl.textContent = `Error: ${msg.error}`;
      progressEl.hidden = true;
      setBusy(false);
    }
  });
}

function showResult(run: SiteRun) {
  resultEl.hidden = false;
  scoreEl.textContent = `${run.summary.score}/100`;
  scoreEl.className = 'score ' + scoreClass(run.summary.score);
  statusEl.textContent = `Scorecard v${run.scorecardVersion} · ${run.summary.passed}/${run.summary.applicable} checks passed`;
  progressEl.hidden = true;
}

function scoreClass(score: number): string {
  if (score >= 90) return 'good';
  if (score >= 70) return 'fair';
  return 'poor';
}

function setBusy(busy: boolean) {
  checkPageBtn.disabled = busy;
  checkSiteBtn.disabled = busy;
}

void init();

// Persist the last run pointer for the results page even before the link is
// clicked, so the user can close the popup and still find their results.
chrome.storage.session?.set({ 'agentready:popup-last-run': lastRun }).catch(() => {});
