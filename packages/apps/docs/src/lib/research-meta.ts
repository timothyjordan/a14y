/**
 * Static metadata for standalone research articles that aren't case studies.
 *
 * The publish date is deliberately FIXED here rather than derived from the
 * survey data's `generatedAt`. Re-aggregating the dataset or making minor edits
 * to the article must not move the published date. Update this value when the
 * real launch/publish date is set.
 */
export const STATE_OF_AGENT_READABILITY_PUBLISHED = '2026-06-25';

/** Static publish date for the per-feature ablation study. Same rationale:
 *  fixed, not derived from the benchmark run timestamps. Update on launch. */
export const FEATURE_ABLATION_PUBLISHED = '2026-06-25';

/** Static publish date for the llms.txt linking / adoption study (TJ-961).
 *  Fixed here, not derived from the benchmark run. Update on launch. */
export const LLMS_TXT_LINKING_PUBLISHED = '2026-07-01';

/**
 * Titles for the standalone research articles, keyed by URL slug, taken
 * from each page's `<h1>`. Case studies are not listed here: their
 * titles come from the published snapshot via `listCaseStudies()`.
 *
 * Used as the link text in llms.txt. Routes reach the discovery files on
 * their own (see `listSiteRoutes`), so a missing entry here degrades to a
 * humanized slug rather than dropping the article, but a test asserts
 * every research route has a real title so new articles get one.
 */
export const RESEARCH_ARTICLE_TITLES: Record<string, string> = {
  'state-of-agent-readability': 'The State of Agent Readability on the Web',
  web: 'How agent-ready is the web?',
  'per-feature-ablation': 'Which agent-readiness features actually pay off',
  'llms-txt-linking': "llms.txt saves an agent real tokens. But it won't read it unless you ask.",
};

/** Format an ISO date (YYYY-MM-DD) as "Month DAY, YEAR" in UTC. */
export function formatPublishDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
