import type { CheckResult } from '../score/compute';
import type { SiteRun } from '../runner/runSite';

export interface AgentPromptOptions {
  /** Cap the number of affected URLs printed per check.
   *  Defaults to 20 — enough for an agent to spot patterns without bloating
   *  the file. Excess URLs are summarized as "and N more". */
  maxUrlsPerCheck?: number;
}

interface FailingEntry {
  id: string;
  name: string;
  group?: string;
  scope: 'site' | 'page';
  docsUrl: string;
  /** URLs of pages where this check failed. Empty for site-scope failures. */
  urls: string[];
  /** All distinct messages observed across the failing instances. */
  messages: string[];
  /** Modal message + how many other variants exist. */
  modalMessage: string;
  variantCount: number;
  /** Number of failing instances (pages for page-scope, 1 for site-scope). */
  count: number;
}

const DEFAULT_MAX_URLS = 20;

/**
 * Render a SiteRun as a markdown fix-list aimed at a coding agent.
 *
 * Failing checks are de-duplicated by stable id and sorted by impact
 * (highest affected-page count first). Each entry links to its docs
 * detail page so the agent can read the rationale and remediation
 * pattern without needing extra context.
 *
 * Only `fail` and `error` results are included — passes, warnings,
 * and n/a entries are skipped because they're not actionable.
 */
export function runToAgentPrompt(run: SiteRun, opts: AgentPromptOptions = {}): string {
  const maxUrls = opts.maxUrlsPerCheck ?? DEFAULT_MAX_URLS;
  const entries = collectFailingEntries(run);

  const lines: string[] = [];
  const totalFailingInstances = entries.reduce((acc, e) => acc + e.count, 0);
  const totalAffectedPages = countDistinctAffectedPages(run);

  lines.push(`# Agent readability fix-list — ${run.url}`);
  lines.push('');

  if (entries.length === 0) {
    lines.push(
      `The a14y scorecard ran against ${run.url} on ${run.finishedAt} ` +
        `and found **no failing checks**. Score: **${run.summary.score}/100**.`,
    );
    lines.push('');
    lines.push('## Nothing to fix');
    lines.push('');
    lines.push(
      'No failing or erroring checks were found in this run. The site is at ' +
        'the maximum score this scorecard version allows. You can stop here.',
    );
    return lines.join('\n') + '\n';
  }

  lines.push(
    `You are an autonomous coding agent. The a14y scorecard ran against ` +
      `${run.url} on ${run.finishedAt} and identified **${entries.length}** distinct ` +
      `failing checks across **${totalAffectedPages}** affected page(s). ` +
      `Score: **${run.summary.score}/100**.`,
  );
  lines.push('');
  lines.push(
    `Your task: work through the failing checks below in order (highest impact ` +
      `first). For each check, read the linked docs page to understand the ` +
      `rationale and remediation pattern, then apply the fix in this codebase. ` +
      `Many of these fixes are template- or build-level — fixing one root cause ` +
      `will often clear the same check on every affected page.`,
  );
  lines.push('');
  lines.push('After applying fixes, re-run the audit to verify:');
  lines.push('');
  lines.push('```');
  lines.push(`a14y check ${run.url} --mode ${run.mode}`);
  lines.push('```');
  lines.push('');

  lines.push('## Snapshot');
  lines.push('');
  lines.push(`- **Score:** ${run.summary.score}/100`);
  lines.push(`- **Mode:** ${run.mode}`);
  lines.push(
    `- **Scorecard:** v${run.scorecardVersion} (released ${run.scorecardReleasedAt})`,
  );
  lines.push(
    `- **Failed:** ${run.summary.failed} (${entries.length} unique check(s), ${totalFailingInstances} instance(s))`,
  );
  lines.push(`- **Errored:** ${run.summary.errored}`);
  lines.push(`- **Passed:** ${run.summary.passed}`);
  lines.push(`- **N/A:** ${run.summary.na}`);
  lines.push(`- **Pages crawled:** ${run.pages.length}`);
  lines.push('');

  lines.push('## Failing checks');
  lines.push('');

  let n = 1;
  for (const e of entries) {
    const header =
      e.scope === 'site'
        ? `### ${n}. \`${e.id}\` — failed site-wide`
        : `### ${n}. \`${e.id}\` — failed on ${e.count} page(s)`;
    lines.push(header);
    lines.push('');
    lines.push(`- **What it checks:** ${e.name}`);
    if (e.group) lines.push(`- **Group:** ${e.group}`);
    const messageLabel = e.scope === 'site' ? 'Message' : 'Sample message';
    const variantSuffix =
      e.variantCount > 0 ? ` _(+ ${e.variantCount} other variant(s))_` : '';
    lines.push(
      `- **${messageLabel}:** ${e.modalMessage ? '`' + escapeInlineCode(e.modalMessage) + '`' : '_(no message)_'}${variantSuffix}`,
    );
    lines.push(`- **Docs:** ${e.docsUrl}`);

    if (e.scope === 'site') {
      lines.push(`- **Scope:** entire site`);
    } else {
      lines.push(`- **Affected pages (${e.urls.length}):**`);
      const shown = e.urls.slice(0, maxUrls);
      for (const u of shown) lines.push(`  - ${u}`);
      const overflow = e.urls.length - shown.length;
      if (overflow > 0) lines.push(`  - … and ${overflow} more`);
    }
    lines.push('');
    n++;
  }

  return lines.join('\n') + '\n';
}

function collectFailingEntries(run: SiteRun): FailingEntry[] {
  const map = new Map<string, FailingEntry>();

  // Site checks: each failing site check is a single entry, no URLs.
  for (const c of run.siteChecks) {
    if (!isFailing(c)) continue;
    const e = ensureEntry(map, c, 'site');
    e.count = 1;
    if (c.message) e.messages.push(c.message);
  }

  // Page checks: aggregate failing instances per id.
  for (const p of run.pages) {
    for (const c of p.checks) {
      if (!isFailing(c)) continue;
      const e = ensureEntry(map, c, 'page');
      e.count++;
      e.urls.push(p.finalUrl);
      if (c.message) e.messages.push(c.message);
    }
  }

  // Compute modal message + variant count for each entry, then sort.
  for (const e of map.values()) {
    const { modal, variantCount } = pickModalMessage(e.messages);
    e.modalMessage = modal;
    e.variantCount = variantCount;
  }

  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.id.localeCompare(b.id);
  });
}

function ensureEntry(
  map: Map<string, FailingEntry>,
  c: CheckResult,
  scope: 'site' | 'page',
): FailingEntry {
  let e = map.get(c.id);
  if (!e) {
    e = {
      id: c.id,
      name: c.name,
      group: c.group,
      scope,
      docsUrl: c.docsUrl,
      urls: [],
      messages: [],
      modalMessage: '',
      variantCount: 0,
      count: 0,
    };
    map.set(c.id, e);
  }
  return e;
}

function isFailing(c: CheckResult): boolean {
  return c.status === 'fail' || c.status === 'error';
}

function pickModalMessage(messages: string[]): { modal: string; variantCount: number } {
  if (messages.length === 0) return { modal: '', variantCount: 0 };
  const counts = new Map<string, number>();
  for (const m of messages) counts.set(m, (counts.get(m) ?? 0) + 1);
  let best = '';
  let bestCount = 0;
  for (const [m, c] of counts) {
    if (c > bestCount) {
      best = m;
      bestCount = c;
    }
  }
  return { modal: best, variantCount: counts.size - 1 };
}

function countDistinctAffectedPages(run: SiteRun): number {
  const urls = new Set<string>();
  for (const p of run.pages) {
    if (p.checks.some(isFailing)) urls.add(p.finalUrl);
  }
  return urls.size;
}

function escapeInlineCode(s: string): string {
  // Backticks would close the inline code span; replace with the
  // backtick-escape sequence so the message stays readable.
  return s.replace(/`/g, '\\`').replace(/[\r\n]+/g, ' ');
}
