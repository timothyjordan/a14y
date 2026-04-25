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
const reportScore = $<HTMLElement>('report-score');
const reportMeta = $<HTMLElement>('report-meta');
const siteTable = $<HTMLTableElement>('site-table').querySelector('tbody')!;
const pagesContainer = $<HTMLElement>('pages-container');
const pageSectionTitle = $<HTMLElement>('page-section-title');
const exportBtn = $<HTMLButtonElement>('export-json');
const exportMdBtn = $<HTMLButtonElement>('export-markdown');
const exportPromptBtn = $<HTMLButtonElement>('export-prompt');
const historyBody = $<HTMLTableElement>('history').querySelector('tbody')!;
const historySection = $<HTMLElement>('history-section');
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

  // Live updates: any time the background writes a new current-run state,
  // re-render. This is what carries the popup-initiated audit through to
  // its final report without the user touching anything.
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

  // Reset all view sections; each branch below shows what it needs.
  empty.hidden = true;
  currentRunEl.hidden = true;
  runErrorEl.hidden = true;
  // History stays visible (collapsed) whenever there's something to show.
  historySection.hidden = cachedHistory.length === 0;

  if (view === 'progress' && state && state.status === 'running') {
    report.hidden = true;
    currentRunEl.hidden = false;
    crUrl.textContent = state.url;
    crMode.textContent = state.mode === 'site' ? 'site scan' : 'page check';
    crProgress.value = state.progress.pct;
    crPhase.textContent = state.progress.phase || 'Starting…';
    return;
  }

  if (view === 'stalled' && state && state.status === 'running') {
    report.hidden = true;
    currentRunEl.hidden = false;
    crUrl.textContent = state.url;
    crMode.textContent = state.mode === 'site' ? 'site scan' : 'page check';
    crProgress.value = state.progress.pct;
    crPhase.className = 'status stale';
    crPhase.textContent = 'Audit may have stalled. Try again from the extension popup.';
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

  // empty
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
  reportScore.textContent = `${run.summary.score}/100`;
  reportScore.className = scoreClass(run.summary.score);
  reportMeta.textContent = ` · scorecard v${run.scorecardVersion} · ${run.summary.passed}/${run.summary.applicable} passed · ${run.pages.length} page(s)`;

  siteTable.innerHTML = '';
  for (const c of run.siteChecks) appendCheckRow(siteTable, c);

  pagesContainer.innerHTML = '';
  if (run.pages.length === 1) {
    pageSectionTitle.textContent = `Page checks — ${run.pages[0].finalUrl}`;
    const wrap = document.createElement('table');
    const tb = document.createElement('tbody');
    wrap.appendChild(tb);
    pagesContainer.appendChild(wrap);
    for (const c of run.pages[0].checks) appendCheckRow(tb, c);
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


function renderPage(p: PageReport): HTMLElement {
  const wrap = document.createElement('details');
  const summary = document.createElement('summary');
  summary.innerHTML = `<span class="${scoreClass(p.summary.score)}">${p.summary.score}</span> · ${escapeHtml(p.finalUrl)} <small>(${p.summary.passed}/${p.summary.applicable})</small>`;
  wrap.appendChild(summary);
  const tbl = document.createElement('table');
  const tb = document.createElement('tbody');
  tbl.appendChild(tb);
  for (const c of p.checks) appendCheckRow(tb, c);
  wrap.appendChild(tbl);
  return wrap;
}

function appendCheckRow(tbody: HTMLTableSectionElement, c: CheckResult) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="${c.status}">${c.status.toUpperCase()}</td>
    <td><a href="${escapeHtml(c.docsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.id)}</a></td>
    <td>${escapeHtml(c.message ?? '')}</td>
  `;
  tbody.appendChild(tr);
}

function renderHistory(runs: Array<{ key: string; run: SiteRun }>) {
  historyBody.innerHTML = '';
  for (const { key, run } of runs) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="${scoreClass(run.summary.score)}">${run.summary.score}</td>
      <td><code>${escapeHtml(run.url)}</code></td>
      <td>v${run.scorecardVersion}</td>
      <td>${new Date(run.startedAt).toLocaleString()}</td>
    `;
    tr.style.cursor = 'pointer';
    tr.onclick = () => renderRun(run);
    tr.dataset.key = key;
    historyBody.appendChild(tr);
  }
}

function scoreClass(score: number): string {
  if (score >= 90) return 'pass';
  if (score >= 70) return 'warn';
  return 'fail';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

void init();
