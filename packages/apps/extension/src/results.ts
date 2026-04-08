/// <reference types="chrome" />

import type { CheckResult, PageReport, SiteRun } from '@agentready/core';
import type { RunRequest, RunResponse } from './bridge';
import { runToMarkdown } from './lib/markdown';

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
const historyBody = $<HTMLTableElement>('history').querySelector('tbody')!;

async function init() {
  const recent = await fetchRecentRuns();
  if (recent.length === 0) {
    empty.hidden = false;
    return;
  }

  // Show the most recent run as the active report; older runs go in History.
  const latest = recent[0].run;
  renderRun(latest);
  renderHistory(recent);
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
    `agentready-${filenameTimestamp(run)}.json`,
  );
  exportMdBtn.onclick = () => downloadBlob(
    runToMarkdown(run),
    'text/markdown',
    `agentready-${filenameTimestamp(run)}.md`,
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
