import type { CheckResult, SiteRun } from '@agentready/core';

/**
 * Serialize a SiteRun as a human-readable markdown report. The shape is
 * intentionally flat and copy-pasteable into an issue, a PR description,
 * or an agent prompt — it prioritizes readability over round-trip
 * fidelity. Use the JSON export for machine consumption.
 *
 * Kept in its own module (not in results.ts) so unit tests can exercise
 * it without pulling in the chrome extension globals.
 */
export function runToMarkdown(run: SiteRun): string {
  const lines: string[] = [];
  lines.push(`# Agent Readability Report`);
  lines.push('');
  lines.push(`- **URL:** ${run.url}`);
  lines.push(`- **Score:** ${run.summary.score}/100`);
  lines.push(
    `- **Scorecard:** v${run.scorecardVersion} (released ${run.scorecardReleasedAt})`,
  );
  lines.push(`- **Mode:** ${run.mode}`);
  lines.push(`- **Started:** ${run.startedAt}`);
  lines.push(`- **Finished:** ${run.finishedAt}`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Passed | Failed | Warned | Errored | N/A | Applicable | Total |`);
  lines.push(`| ---: | ---: | ---: | ---: | ---: | ---: | ---: |`);
  lines.push(
    `| ${run.summary.passed} | ${run.summary.failed} | ${run.summary.warned} | ${run.summary.errored} | ${run.summary.na} | ${run.summary.applicable} | ${run.summary.total} |`,
  );
  lines.push('');

  lines.push(`## Site checks`);
  lines.push('');
  lines.push(...renderChecksAsMarkdown(run.siteChecks));

  if (run.pages.length === 1) {
    const p = run.pages[0];
    lines.push(`## Page checks — ${p.finalUrl}`);
    lines.push('');
    lines.push(...renderChecksAsMarkdown(p.checks));
  } else {
    lines.push(`## Pages (${run.pages.length})`);
    lines.push('');
    for (const p of run.pages) {
      lines.push(
        `### ${p.summary.score}/100 — ${p.finalUrl} _(${p.summary.passed}/${p.summary.applicable} passed)_`,
      );
      lines.push('');
      lines.push(...renderChecksAsMarkdown(p.checks));
    }
  }

  return lines.join('\n') + '\n';
}

function renderChecksAsMarkdown(checks: CheckResult[]): string[] {
  if (checks.length === 0) return ['_No checks._', ''];
  // Group by `group` preserving insertion order so the markdown mirrors
  // the UI's category layout.
  const groups: Array<{ group: string; items: CheckResult[] }> = [];
  for (const c of checks) {
    const groupName = c.group ?? 'Other';
    let bucket = groups.find((g) => g.group === groupName);
    if (!bucket) {
      bucket = { group: groupName, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(c);
  }
  const out: string[] = [];
  for (const { group, items } of groups) {
    out.push(`**${group}**`);
    out.push('');
    for (const c of items) {
      const icon = statusIcon(c.status);
      const msg = c.message ? ` — ${escapeMarkdown(c.message)}` : '';
      out.push(`- ${icon} \`${c.id}\` (${c.status})${msg}`);
    }
    out.push('');
  }
  return out;
}

function statusIcon(status: CheckResult['status']): string {
  switch (status) {
    case 'pass':
      return '✅';
    case 'fail':
      return '❌';
    case 'warn':
      return '⚠️';
    case 'error':
      return '🛑';
    case 'na':
      return '➖';
  }
}

function escapeMarkdown(s: string): string {
  // The message can contain backticks (which break the inline code
  // formatting in the bullet) or embedded newlines (which break the
  // bullet layout). Everything else passes through untouched.
  return s.replace(/`/g, '\\`').replace(/[\r\n]+/g, ' ');
}
