import type { SiteRun } from '@a14y/core';

/**
 * A plain-language summary of one site's a14y result, generated from its
 * real scan data so every `/leaderboard/<slug>/` page carries unique,
 * substantive prose instead of a templated score card.
 *
 * Motivation (TJ-1430): Google reported the per-site leaderboard pages as
 * "Crawled - currently not indexed" because, above the fold, they were a
 * number and a set of templated lists with no unique text. This turns each
 * site's actual score, coverage, and discovery-file presence into three
 * neutral, factual sentences.
 *
 * Tone is deliberately neutral: state the facts, no editorial consequence.
 * The sentences are returned separately so callers can join them into a
 * paragraph (or test them individually); the numbers describe the run that
 * is passed in (the statically rendered default scorecard version).
 */

/** The four core agent-discovery surfaces, in reading order, keyed by the
 *  site-level `*.exists` check that determines whether the site ships one. */
const DISCOVERY_SURFACES: ReadonlyArray<{ existsCheckId: string; label: string }> = [
  { existsCheckId: 'llms-txt.exists', label: 'llms.txt' },
  { existsCheckId: 'agents-md.exists', label: 'AGENTS.md' },
  { existsCheckId: 'sitemap-xml.exists', label: 'an XML sitemap' },
  { existsCheckId: 'sitemap-md.exists', label: 'a markdown sitemap' },
];

/** Oxford-comma join: [] -> "", [a] -> "a", [a,b] -> "a and b",
 *  [a,b,c] -> "a, b, and c". */
function joinList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function checkStatus(run: SiteRun, id: string): string | undefined {
  return run.siteChecks.find((c) => c.id === id)?.status;
}

/**
 * Three neutral, factual sentences describing this site's run:
 *   1. the score,
 *   2. how much was scanned and the pass rate,
 *   3. which core discovery surfaces the site publishes (omitted when the
 *      run evaluated none of them, e.g. a single-page check).
 *
 * Returns 2 or 3 sentences (never empty). Join with a space for a paragraph.
 */
export function buildSiteNarrative(run: SiteRun, siteName: string): string[] {
  const sentences: string[] = [];

  // 1. Score.
  sentences.push(
    `${siteName} scores ${run.summary.score} out of 100 on the a14y v${run.scorecardVersion} scorecard.`,
  );

  // 2. Coverage + pass rate.
  const pages = run.pages.length;
  const applicable = run.summary.applicable;
  const passPct = applicable > 0 ? Math.round((100 * run.summary.passed) / applicable) : 0;
  if (pages === 0) {
    sentences.push('The scan recorded no auditable pages.');
  } else {
    const scanned =
      pages === 1 ? 'checked a single page' : `covered ${pages.toLocaleString('en-US')} pages`;
    sentences.push(`The scan ${scanned}, and ${passPct}% of the applicable checks passed.`);
  }

  // 3. Discovery surfaces the site publishes. Only surfaces the run actually
  //    evaluated are reported, so a page-mode check with no site-level checks
  //    contributes no (and no misleading) discovery sentence.
  const evaluated = DISCOVERY_SURFACES.filter(
    (s) => checkStatus(run, s.existsCheckId) !== undefined,
  );
  if (evaluated.length > 0) {
    const present = evaluated.filter((s) => checkStatus(run, s.existsCheckId) === 'pass');
    const absent = evaluated.filter((s) => !present.includes(s));

    const label = (s: (typeof DISCOVERY_SURFACES)[number]): string => {
      // Distinguish a valid XML sitemap from a merely-present one when the
      // run checked validity — a small, real, per-site distinction.
      if (s.existsCheckId === 'sitemap-xml.exists' && checkStatus(run, 'sitemap-xml.valid') === 'pass') {
        return 'a valid XML sitemap';
      }
      return s.label;
    };

    const presentPhrases = present.map(label);
    const absentPhrases = absent.map((s) => s.label);

    if (absent.length === 0) {
      sentences.push(`The site publishes ${joinList(presentPhrases)}.`);
    } else if (present.length === 0) {
      sentences.push(
        `The site publishes none of the core agent-discovery files: ${joinList(absentPhrases)}.`,
      );
    } else {
      sentences.push(
        `The site publishes ${joinList(presentPhrases)}; ${joinList(absentPhrases)} ${
          absent.length === 1 ? 'is' : 'are'
        } absent.`,
      );
    }
  }

  return sentences;
}
