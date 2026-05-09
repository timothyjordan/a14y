/// <reference types="chrome" />

import {
  buildBadgeUrl,
  formatShareSummary,
  runToAgentPrompt,
  type CheckResult,
  type PageReport,
  type SiteRun,
} from '@a14y/core';
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
const shareBtn = $<HTMLButtonElement>('share-score');
const sharePopover = $<HTMLElement>('share-popover');
const shareTextEl = $<HTMLElement>('share-text');
const shareXLink = $<HTMLAnchorElement>('share-x');
const shareLinkedInBtn = $<HTMLButtonElement>('share-linkedin');
const shareBlueskyLink = $<HTMLAnchorElement>('share-bluesky');
const shareEmbedLink = $<HTMLAnchorElement>('share-embed');
const shareCopyBtn = $<HTMLButtonElement>('share-copy');
const shareCloseBtn = $<HTMLButtonElement>('share-close');
const shareStatus = $<HTMLElement>('share-status');
const shareActionsRow = $<HTMLElement>('share-actions');
const shareLinkedInConfirm = $<HTMLElement>('share-linkedin-confirm');
const shareLinkedInContinue = $<HTMLAnchorElement>('share-linkedin-continue');
const shareLinkedInBack = $<HTMLButtonElement>('share-linkedin-back');

const SHARE_CTA_URL = 'https://a14y.dev?utm_source=extension&utm_medium=share';
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

  shareBtn.onclick = () => openSharePopover(run);
}

function openSharePopover(run: SiteRun): void {
  const text = formatShareSummary(run, { surface: 'extension' });
  shareTextEl.textContent = text;
  shareStatus.textContent = '';
  // X and Bluesky accept prefilled post text. LinkedIn's share-offsite intent
  // only takes a URL, so the LinkedIn button opens a confirm step (handled
  // separately) instead of going straight to LinkedIn.
  shareXLink.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
  shareBlueskyLink.href = `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
  shareEmbedLink.href = buildBadgeUrl(run);
  shareLinkedInContinue.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SHARE_CTA_URL)}`;
  showShareActionsView();
  sharePopover.hidden = false;
  positionSharePopover();
  window.addEventListener('resize', positionSharePopover);
  window.addEventListener('scroll', positionSharePopover, { passive: true });
  document.addEventListener('keydown', onSharePopoverKey);
  document.addEventListener('mousedown', onSharePopoverOutsideClick);
  shareCopyBtn.focus();
}

function showShareActionsView(): void {
  shareActionsRow.hidden = false;
  shareLinkedInConfirm.hidden = true;
}

function showLinkedInConfirmView(): void {
  shareActionsRow.hidden = true;
  shareLinkedInConfirm.hidden = false;
  // Recompute placement — the confirm view's height differs from the icon row.
  positionSharePopover();
  shareLinkedInContinue.focus();
}

function closeSharePopover(): void {
  if (sharePopover.hidden) return;
  sharePopover.hidden = true;
  window.removeEventListener('resize', positionSharePopover);
  window.removeEventListener('scroll', positionSharePopover);
  document.removeEventListener('keydown', onSharePopoverKey);
  document.removeEventListener('mousedown', onSharePopoverOutsideClick);
  shareBtn.focus();
}

function positionSharePopover(): void {
  const rect = shareBtn.getBoundingClientRect();
  // Place the popover anchored to the button's bottom-left in document
  // coordinates. width: min(380px, viewport-32px) is set in CSS, so clamp
  // here to keep the right edge inside the viewport with an 8px margin.
  const popoverWidth = sharePopover.offsetWidth;
  const margin = 8;
  const maxLeft = window.scrollX + window.innerWidth - popoverWidth - margin;
  const desiredLeft = window.scrollX + rect.left;
  const left = Math.max(window.scrollX + margin, Math.min(desiredLeft, maxLeft));
  const top = window.scrollY + rect.bottom + 6;
  sharePopover.style.left = `${left}px`;
  sharePopover.style.top = `${top}px`;
}

function onSharePopoverKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeSharePopover();
  }
}

function onSharePopoverOutsideClick(event: MouseEvent): void {
  const target = event.target as Node | null;
  if (!target) return;
  if (sharePopover.contains(target) || shareBtn.contains(target)) return;
  closeSharePopover();
}

shareCopyBtn.onclick = async () => {
  try {
    await navigator.clipboard.writeText(shareTextEl.textContent ?? '');
    shareStatus.textContent = 'Copied!';
  } catch {
    shareStatus.textContent = 'Copy failed — select the text and copy manually.';
  }
};
// LinkedIn's share intent only carries a URL — show a confirm step that
// copies the share text to the clipboard first, then offers a button to
// continue to LinkedIn where the user pastes the text into the post body.
// LinkedIn's own URL preview will render the CTA link, so strip the last
// paragraph (the "Audit your own site…" line) — pasting it would duplicate
// the link the preview is already showing.
shareLinkedInBtn.onclick = async () => {
  const linkedInText = withoutCtaParagraph(shareTextEl.textContent ?? '');
  try {
    await navigator.clipboard.writeText(linkedInText);
  } catch {
    /* clipboard may be unavailable — the user can still copy from the
       <pre> via triple-click before continuing to LinkedIn. */
  }
  showLinkedInConfirmView();
};

function withoutCtaParagraph(text: string): string {
  const paragraphs = text.split('\n\n');
  if (paragraphs.length <= 1) return text;
  return paragraphs.slice(0, -1).join('\n\n');
}
shareLinkedInBack.onclick = () => {
  showShareActionsView();
  shareLinkedInBtn.focus();
};
shareLinkedInContinue.addEventListener('click', () => {
  // Close the popover after the user follows the link out so the next time
  // they open share they start fresh on the icon row.
  closeSharePopover();
});
shareCloseBtn.onclick = closeSharePopover;

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
