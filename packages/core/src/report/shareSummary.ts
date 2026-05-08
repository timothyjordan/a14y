import type { SiteRun } from '../runner/runSite';
import { DOCS_BASE_URL } from '../scorecard/docsUrl';

export interface ShareSummaryOptions {
  /** Which surface is rendering the block. Tags the CTA URL so the team can
   *  see which surface drives traffic to a14y.dev. */
  surface: 'cli' | 'extension' | 'skill';
  /** Override the CTA URL entirely. Mostly useful for tests. */
  ctaUrl?: string;
  /** When set and lower than the run's score, the lead line becomes
   *  "… for Agent Readability — up from <prior> after today's fixes." */
  priorScore?: number;
}

/**
 * Render a SiteRun as a copy-pasteable, ~tweet-sized share block.
 *
 * Output is plain text (no ANSI, no Markdown) so the CLI, extension popover,
 * and skill prose can all surface the same string verbatim.
 */
export function formatShareSummary(run: SiteRun, opts: ShareSummaryOptions): string {
  const score = run.summary.score;
  const hostname = safeHostname(run.url);
  const ctaUrl = opts.ctaUrl ?? defaultCtaUrl(opts.surface);
  const showLift = opts.priorScore !== undefined && opts.priorScore < score;
  const lead = showLift
    ? `My site, ${hostname}, scored ${score}/100 for Agent Readability — up from ${opts.priorScore} after today's fixes.`
    : `My site, ${hostname}, scored ${score}/100 for Agent Readability.`;
  const meta = `Scorecard v${run.scorecardVersion} · ${run.summary.passed}/${run.summary.applicable} checks passed`;
  const cta = `Audit your own site at ${ctaUrl}`;
  return `${lead}\n\n${meta}\n\n${cta}`;
}

function defaultCtaUrl(surface: ShareSummaryOptions['surface']): string {
  return `${DOCS_BASE_URL}?utm_source=${surface}&utm_medium=share`;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
