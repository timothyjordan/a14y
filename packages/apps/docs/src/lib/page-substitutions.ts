/**
 * Token substitution for the `pages` content collection.
 *
 * Both pipelines that produce page output — Astro's markdown
 * rendering (HTML pages) and the markdown-mirrors integration
 * (`.md` mirrors) — feed user-authored markdown through
 * `applyPageSubstitutions` so dynamic values stay in sync with
 * `@a14y/core`'s scorecard registry.
 */
import {
  getLatestScorecardVersion,
  getScorecardByVersion,
} from './scorecard-data';

export type PageSubstitutions = Record<string, string>;

export function getPageSubstitutions(): PageSubstitutions {
  const version = getLatestScorecardVersion();
  const scorecard = getScorecardByVersion(version);
  return {
    LATEST_VERSION: version,
    RELEASED_AT: scorecard.releasedAt,
    TOTAL_CHECKS: String(
      scorecard.siteChecks.length + scorecard.pageChecks.length,
    ),
    SITE_CHECK_COUNT: String(scorecard.siteChecks.length),
    PAGE_CHECK_COUNT: String(scorecard.pageChecks.length),
    LAST_UPDATED: new Date().toISOString().slice(0, 10),
  };
}

export function applyPageSubstitutions(
  text: string,
  subs: PageSubstitutions = getPageSubstitutions(),
): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => {
    const value = subs[key];
    return value === undefined ? match : value;
  });
}
