/// <reference types="chrome" />

import { runToAgentPrompt, type CheckResult, type PageReport, type SiteRun } from '@a14y/core';
import {
  CURRENT_RUN_KEY,
  type CurrentRunState,
  type RunRequest,
  type RunResponse,
} from './bridge';
import { runToMarkdown } from './lib/markdown';
import { attachThemeToggle } from './lib/theme';
import { decideView } from './lib/results-view';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const empty = $<HTMLElement>('empty');
const report = $<HTMLElement>('report');
const reportUrl = $<HTMLElement>('report-url');
const reportModeChip = $<HTMLElement>('report-mode-chip');
const reportScore = $<HTMLElement>('report-score');
const reportMeta = $<HTMLElement>('report-meta');
const scorecardEl = $<HTMLElement>('scorecard');
const siteList = $<HTMLUListElement>('site-checks');
const siteCount = $<HTMLElement>('site-count');
const pageList = $<HTMLUListElement>('page-checks');
const pagesContainer = $<HTMLElement>('pages-container');
const pageSectionTitle = $<HTMLElement>('page-section-title');
const exportBtn = $<HTMLButtonElement>('export-json');
const exportMdBtn = $<HTMLButtonElement>('export-markdown');
const exportPromptBtn = $<HTMLButtonElement>('export-prompt');
const historyBody = $<HTMLTableElement>('history').querySelector('tbody')!;
const historySection = $<HTMLDetailsElement>('history-section');
const currentRunEl = $<HTMLElement>('current-run');
const runErrorEl = $<HTMLElement>('run-error');
const crUrl = $<HTMLElement>('cr-url');
const crMode = $<HTMLElement>('cr-mode');
const crProgress = $<HTMLProgressElement>('cr-progress');
const crPhase = $<HTMLElement>('cr-phase');
const crErrorMsg = $<HTMLElement>('cr-error-msg');

let cachedHistory: Array<{ key: string; run: SiteRun }> = [];

async function init() {
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn instanceof HTMLButtonElement) attachThemeToggle(themeBtn);

  const [recent, currentRaw] = await Promise.all([fetchRecentRuns(), readCurrentRun()]);
  cachedHistory = recent;
  if (recent.length > 0) renderHistory(recent);

  applyState(currentRaw);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (!(CURRENT_RUN_KEY in changes)) return;
    applyState((changes[CURRENT_RUN_KEY].newValue ?? null) as CurrentRunState | null);
  });
}

async function readCurrentRun(): Promise<CurrentRunState | null> {
  const data = await chrome.storage.local.get(CURRENT_RUN_KEY);
  return (data[CURRENT_RUN_KEY] as CurrentRunState | undefined) ?? null;
}

function applyState(state: CurrentRunState | null) {
  const view = decideView(state, cachedHistory.map((r) => r.run));

  empty.hidden = true;
  currentRunEl.hidden = true;
  runErrorEl.hidden = true;
  historySection.hidden = cachedHistory.length === 0;

  if ((view === 'progress' || view === 'stalled') && state && state.status === 'running') {
    report.hidden = true;
    currentRunEl.hidden = false;
    crUrl.textContent = state.url;
    crMode.textContent = state.mode === 'site' ? 'site scan' : 'page check';
    crMode.className = `chip ${state.mode === 'site' ? 'site' : 'page'}`;
    crProgress.value = state.progress.pct;
    if (view === 'stalled') {
      crPhase.className = 'status stale';
      crPhase.textContent = 'Audit may have stalled. Try again from the extension popup.';
    } else {
      crPhase.className = 'status';
      crPhase.textContent = state.progress.phase || 'Starting…';
    }
    return;
  }

  if (view === 'report-current' && state && state.status === 'done' && state.result) {
    renderRun(state.result);
    return;
  }

  if (view === 'error' && state && state.status === 'error') {
    report.hidden = true;
    runErrorEl.hidden = false;
    crErrorMsg.textContent = state.error ?? 'Unknown error';
    return;
  }

  if (view === 'report-historical') {
    renderRun(cachedHistory[0].run);
    return;
  }

  empty.hidden = false;
  report.hidden = true;
}

async function fetchRecentRuns(): Promise<Array<{ key: string; run: SiteRun }>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'get-recent-runs' } satisfies RunRequest, (resp: RunResponse) => {
      if (resp?.type === 'recent-runs') resolve(resp.runs);
      else resolve([]);
    });
  });
}

function renderRun(run: SiteRun) {
  report.hidden = false;
  reportUrl.textContent = run.url;

  const isSite = run.mode === 'site';
  reportModeChip.textContent = isSite ? 'site scan' : 'page check';
  reportModeChip.className = `chip ${isSite ? 'site' : 'page'}`;

  reportScore.textContent = `${run.summary.score}`;
  reportScore.className = `score-number ${scoreClass(run.summary.score)}`;
  reportMeta.textContent = `out of 100 · scorecard v${run.scorecardVersion} · ${run.summary.passed}/${run.summary.applicable} checks passed · ${run.pages.length} page${run.pages.length === 1 ? '' : 's'}`;

  scorecardEl.classList.toggle('scorecard-callout--page', !isSite);

  // Site checks
  siteList.innerHTML = '';
  for (const c of run.siteChecks) siteList.appendChild(checkCard(c));
  siteCount.textContent = run.siteChecks.length === 0 ? '(none)' : `(${run.siteChecks.length})`;

  // Page checks
  pageList.innerHTML = '';
  pagesContainer.innerHTML = '';
  if (run.pages.length === 1) {
    pageSectionTitle.textContent = `Page checks — ${run.pages[0].finalUrl}`;
    for (const c of run.pages[0].checks) pageList.appendChild(checkCard(c));
  } else {
    pageSectionTitle.textContent = `Pages (${run.pages.length})`;
    for (const p of run.pages) pagesContainer.appendChild(renderPage(p));
  }

  exportBtn.onclick = () => downloadBlob(
    JSON.stringify(run, null, 2),
    'application/json',
    `a14y-${filenameTimestamp(run)}.json`,
  );
  exportMdBtn.onclick = () => downloadBlob(
    runToMarkdown(run),
    'text/markdown',
    `a14y-${filenameTimestamp(run)}.md`,
  );
  exportPromptBtn.onclick = () => downloadBlob(
    runToAgentPrompt(run),
    'text/markdown',
    `a14y-fixes-${filenameTimestamp(run)}.md`,
  );
}

function checkCard(c: CheckResult): HTMLLIElement {
  const li = document.createElement('li');
  li.className = `check-card status-${c.status}`;
  const link = document.createElement('a');
  link.className = 'check-card-link';
  link.href = c.docsUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const tag = document.createElement('span');
  tag.className = 'status-tag';
  tag.textContent = c.status.toUpperCase();
  const id = document.createElement('div');
  id.className = 'id';
  id.textContent = c.id;
  link.appendChild(tag);
  link.appendChild(id);
  if (c.message) {
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.textContent = c.message;
    link.appendChild(msg);
  }
  li.appendChild(link);
  return li;
}

function renderPage(p: PageReport): HTMLElement {
  const wrap = document.createElement('details');
  wrap.className = 'page-details';
  const summary = document.createElement('summary');
  const score = document.createElement('span');
  score.className = `page-score ${scoreClass(p.summary.score)}`;
  score.textContent = `${p.summary.score}`;
  const url = document.createElement('span');
  url.className = 'page-url';
  url.textContent = p.finalUrl;
  const counts = document.createElement('span');
  counts.className = 'page-counts';
  counts.textContent = `${p.summary.passed}/${p.summary.applicable}`;
  summary.appendChild(score);
  summary.appendChild(url);
  summary.appendChild(counts);
  wrap.appendChild(summary);
  const list = document.createElement('ul');
  list.className = 'check-list';
  for (const c of p.checks) list.appendChild(checkCard(c));
  wrap.appendChild(list);
  return wrap;
}

function filenameTimestamp(run: SiteRun): string {
  return new Date(run.startedAt).toISOString().replace(/[:.]/g, '-');
}

function downloadBlob(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renderHistory(runs: Array<{ key: string; run: SiteRun }>) {
  historyBody.innerHTML = '';
  for (const { key, run } of runs) {
    const tr = document.createElement('tr');
    const isSite = run.mode === 'site';
    tr.innerHTML = `
      <td class="${scoreClass(run.summary.score)}">${run.summary.score}</td>
      <td><span class="chip ${isSite ? 'site' : 'page'}">${isSite ? 'Site' : 'Page'}</span></td>
      <td><code>${escapeHtml(run.url)}</code></td>
      <td>v${run.scorecardVersion}</td>
      <td>${new Date(run.startedAt).toLocaleString()}</td>
    `;
    tr.onclick = () => renderRun(run);
    tr.dataset.key = key;
    historyBody.appendChild(tr);
  }
}

function scoreClass(score: number): 'pass' | 'warn' | 'fail' {
  if (score >= 90) return 'pass';
  if (score >= 70) return 'warn';
  return 'fail';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

void init();
