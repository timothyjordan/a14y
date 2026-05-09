import type { RunMode, SiteRun } from '../runner/runSite';
import { DOCS_BASE_URL } from '../scorecard/docsUrl';

// The /badge/ page on the docs site decodes these params into a BadgeData
// and re-encodes them as the inline-styled embed snippet. Short keys keep
// the URL compact for paste-friendliness.
export const BADGE_BASE_URL = DOCS_BASE_URL;

export type BadgeTheme = 'light' | 'dark';

export interface BadgeData {
  score: number;
  scorecardVersion: string;
  applicable: number;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  errored: number;
  na: number;
  /** ISO date `YYYY-MM-DD` (or empty string when not available). */
  date: string;
  mode?: RunMode;
  /** Audited URL — the docs page renders the host (with `www.` stripped). */
  url?: string;
  theme: BadgeTheme;
}

export function buildBadgeUrl(run: SiteRun, baseUrl: string = BADGE_BASE_URL): string {
  const u = new URL('/badge/', baseUrl);
  const q = u.searchParams;
  q.set('s', String(run.summary.score));
  q.set('v', run.scorecardVersion);
  q.set('a', String(run.summary.applicable));
  q.set('t', String(run.summary.total));
  q.set('p', String(run.summary.passed));
  q.set('f', String(run.summary.failed));
  q.set('w', String(run.summary.warned));
  q.set('e', String(run.summary.errored));
  q.set('n', String(run.summary.na));
  q.set('d', run.finishedAt.slice(0, 10));
  q.set('m', run.mode);
  q.set('u', run.url);
  return u.toString();
}

export function parseBadgeParams(search: string | URLSearchParams): BadgeData | null {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const score = numOrNull(q.get('s'));
  const applicable = numOrNull(q.get('a'));
  const total = numOrNull(q.get('t'));
  if (score === null || applicable === null || total === null) return null;
  // theme=dark is the only opt-in; everything else (including a stale
  // theme=auto from earlier snippets) falls back to light.
  const theme: BadgeTheme = q.get('theme') === 'dark' ? 'dark' : 'light';
  const modeRaw = q.get('m');
  return {
    score,
    scorecardVersion: q.get('v') ?? '',
    applicable,
    total,
    passed: numOrNull(q.get('p')) ?? 0,
    failed: numOrNull(q.get('f')) ?? 0,
    warned: numOrNull(q.get('w')) ?? 0,
    errored: numOrNull(q.get('e')) ?? 0,
    na: numOrNull(q.get('n')) ?? 0,
    date: q.get('d') ?? '',
    mode: modeRaw === 'page' || modeRaw === 'site' ? modeRaw : undefined,
    url: q.get('u') ?? undefined,
    theme,
  };
}

function numOrNull(v: string | null): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
