/**
 * Client-side driver for the homepage "scan your site" widget. Runs an
 * @a14y/core page-mode audit entirely in the browser, routing cross-origin
 * fetches through the scan proxy (see `proxy-fetch.ts`), and renders the
 * result inline.
 *
 * The heavy engine (@a14y/core + cheerio) is loaded lazily on the first scan
 * so it never weighs down the landing page's initial load.
 */
import type { CheckResult, ProgressEvent as ScanProgressEvent, SiteRun } from '@a14y/core';
import { SCAN_PROXY_URL } from './config';
import { createProxyFetch } from './proxy-fetch';
import { classifyScanError, issueBucket, scoreBucket, trackEvent } from '../analytics';

type StatusKind = 'busy' | 'error';

export function initScanWidget(root: ParentNode = document): void {
  const form = root.querySelector<HTMLFormElement>('[data-scan-form]');
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>('[data-scan-input]');
  const submit = form.querySelector<HTMLButtonElement>('[data-scan-submit]');
  const scorecardSelect = root.querySelector<HTMLSelectElement>('[data-scan-scorecard]');
  const statusEl = root.querySelector<HTMLElement>('[data-scan-status]');
  const resultsEl = root.querySelector<HTMLElement>('[data-scan-results]');
  if (!input || !submit || !statusEl || !resultsEl) return;

  let running = false;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (running) return;

    const target = normalizeUrl(input.value);
    if (!target) {
      trackEvent('scan_error', { error_class: 'invalid_url' });
      showStatus(statusEl, 'Enter a valid site URL, like example.com', 'error');
      return;
    }
    if (!SCAN_PROXY_URL) {
      showStatus(statusEl, 'Scanning is not available right now. Try the CLI or extension below.', 'error');
      return;
    }

    const scorecardVersion = scorecardSelect?.value || undefined;

    running = true;
    setBusy(submit, true);
    resultsEl.hidden = true;
    resultsEl.replaceChildren();
    showStatus(statusEl, 'Loading the scan engine…', 'busy');
    trackEvent('scan_started', { scorecard_version: scorecardVersion ?? 'latest' });

    void runScan(target, scorecardVersion, statusEl, resultsEl)
      .catch((err) => {
        trackEvent('scan_error', { error_class: classifyScanError(err) });
        showStatus(statusEl, scanErrorMessage(err), 'error');
      })
      .finally(() => {
        running = false;
        setBusy(submit, false);
      });
  });
}

async function runScan(
  target: string,
  scorecardVersion: string | undefined,
  statusEl: HTMLElement,
  resultsEl: HTMLElement,
): Promise<void> {
  const { validate, createHttpClient, runToAgentPrompt } = await import('@a14y/core');
  const http = createHttpClient({ fetchImpl: createProxyFetch(SCAN_PROXY_URL) });

  showStatus(statusEl, `Scanning ${target}…`, 'busy');
  const run = await validate({
    url: target,
    mode: 'page',
    scorecardVersion,
    http,
    onProgress: (event) => onProgress(event, statusEl, target),
  });

  trackEvent('scan_completed', {
    score_bucket: scoreBucket(run.summary.score),
    scorecard_version: run.scorecardVersion,
    failed_bucket: issueBucket(run.summary.failed),
  });

  renderResults(resultsEl, run, runToAgentPrompt);
  statusEl.hidden = true;
}

function onProgress(event: ScanProgressEvent, statusEl: HTMLElement, target: string): void {
  if (event.type === 'page-done') {
    showStatus(statusEl, 'Analyzing results…', 'busy');
  } else if (event.type === 'started') {
    showStatus(statusEl, `Scanning ${target}…`, 'busy');
  }
}

// --- rendering ---------------------------------------------------------------

function renderResults(
  container: HTMLElement,
  run: SiteRun,
  runToAgentPrompt: (run: SiteRun) => string,
): void {
  const checks = [...run.siteChecks, ...(run.pages[0]?.checks ?? [])];
  const failed = checks.filter((c) => c.status === 'fail' || c.status === 'error');
  const warned = checks.filter((c) => c.status === 'warn');
  const passed = checks.filter((c) => c.status === 'pass');

  container.replaceChildren(
    scoreHeader(run),
    ...(failed.length ? [checkGroup('Needs fixing', failed, 8)] : []),
    ...(warned.length ? [checkGroup('Worth a look', warned, 8)] : []),
    ...(passed.length ? [passedDetails(passed)] : []),
    ...(failed.length ? [copyFixList(run, runToAgentPrompt)] : []),
    fullExperienceCta(),
  );
  container.hidden = false;
}

function scoreHeader(run: SiteRun): HTMLElement {
  const wrap = el('div', 'scan-score-row');

  const scoreBox = el('div', `scan-score scan-score--${scoreClass(run.summary.score)}`);
  const num = el('span', 'scan-score-num');
  num.textContent = String(run.summary.score);
  const outOf = el('span', 'scan-score-outof');
  outOf.textContent = '/100';
  scoreBox.append(num, outOf);

  const meta = el('div', 'scan-score-meta');
  const title = el('p', 'scan-score-title');
  title.textContent = 'Single-page preview';
  const sub = el('p', 'scan-score-sub');
  const { passed, applicable } = run.summary;
  sub.textContent = `${passed}/${applicable} checks passed · scorecard v${run.scorecardVersion}`;
  const urlLine = el('p', 'scan-score-url');
  urlLine.textContent = run.url;
  meta.append(title, sub, urlLine);

  wrap.append(scoreBox, meta);
  return wrap;
}

function checkGroup(label: string, checks: CheckResult[], collapseAfter = Infinity): HTMLElement {
  const section = el('div', 'scan-group');
  const heading = el('h3', 'scan-group-head');
  heading.textContent = `${label} (${checks.length})`;
  const list = el('ul', 'scan-check-list');
  const cards = checks.map(checkCard);
  for (const card of cards) list.append(card);
  section.append(heading, list);

  if (checks.length > collapseAfter) {
    const overflow = cards.slice(collapseAfter);
    for (const card of overflow) card.classList.add('scan-hidden');
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn btn--ghost scan-more';
    more.textContent = `Show ${overflow.length} more`;
    more.addEventListener('click', () => {
      for (const card of overflow) card.classList.remove('scan-hidden');
      more.remove();
    });
    section.append(more);
  }
  return section;
}

function passedDetails(checks: CheckResult[]): HTMLElement {
  const details = document.createElement('details');
  details.className = 'scan-passed';
  const summary = document.createElement('summary');
  summary.textContent = `Passed (${checks.length})`;
  const list = el('ul', 'scan-check-list');
  for (const check of checks) list.append(checkCard(check));
  details.append(summary, list);
  return details;
}

function checkCard(check: CheckResult): HTMLLIElement {
  const li = document.createElement('li');
  li.className = `scan-check scan-check--${check.status}`;

  const link = document.createElement('a');
  link.className = 'scan-check-link';
  link.href = check.docsUrl;
  link.target = '_blank';
  link.rel = 'noopener';

  const tag = el('span', 'scan-check-tag');
  tag.textContent = check.status.toUpperCase();

  const body = el('span', 'scan-check-body');
  const id = el('span', 'scan-check-id');
  id.textContent = check.id;
  body.append(id);
  if (check.message) {
    const msg = el('span', 'scan-check-msg');
    msg.textContent = check.message;
    body.append(msg);
  }

  link.append(tag, body);
  li.append(link);
  return li;
}

function copyFixList(run: SiteRun, runToAgentPrompt: (run: SiteRun) => string): HTMLElement {
  const wrap = el('div', 'scan-actions');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--ghost scan-copy';
  button.textContent = 'Copy fix list';
  button.addEventListener('click', () => {
    trackEvent('scan_copy_fixlist');
    void navigator.clipboard
      .writeText(runToAgentPrompt(run))
      .then(() => {
        const original = button.textContent;
        button.textContent = 'Copied ✓';
        window.setTimeout(() => {
          button.textContent = original;
        }, 1500);
      })
      .catch(() => {
        button.textContent = 'Copy failed';
      });
  });
  const note = el('span', 'scan-actions-note');
  note.textContent = 'Markdown fix-list ready to hand to a coding agent.';
  wrap.append(button, note);
  return wrap;
}

function fullExperienceCta(): HTMLElement {
  const cta = el('aside', 'scan-cta');
  const heading = el('p', 'scan-cta-head');
  heading.textContent = 'Scan your whole site';
  const body = el('p', 'scan-cta-body');
  body.textContent =
    'This preview covers one page. The CLI, the agent skill, and the Chrome extension run the same checks across your entire site, then hand you the fixes.';

  const links = el('div', 'scan-cta-links');
  const ctaButton = ctaLink('#tools', 'Install the tools →');
  ctaButton.dataset.installIntent = 'tools';
  ctaButton.dataset.installSource = 'scan_results';
  links.append(ctaButton);

  cta.append(heading, body, links);
  return cta;
}

function ctaLink(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'btn btn--primary scan-cta-link';
  a.href = href;
  a.textContent = text;
  return a;
}

// --- helpers -----------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function scoreClass(score: number): 'pass' | 'warn' | 'fail' {
  if (score >= 90) return 'pass';
  if (score >= 70) return 'warn';
  return 'fail';
}

function showStatus(statusEl: HTMLElement, message: string, kind: StatusKind): void {
  statusEl.textContent = message;
  statusEl.dataset.kind = kind;
  statusEl.hidden = false;
}

function setBusy(button: HTMLButtonElement, busy: boolean): void {
  button.disabled = busy;
  button.classList.toggle('is-busy', busy);
}

/** Accept "example.com", "https://example.com", etc. Returns a normalized
 *  http(s) URL string, or null if it can't be made into one. */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // Require a dotted host (or it's almost certainly a typo, not a public site).
  if (!url.hostname.includes('.')) return null;
  return url.toString();
}

function scanErrorMessage(err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  return `Couldn't scan that site. ${detail}`;
}
