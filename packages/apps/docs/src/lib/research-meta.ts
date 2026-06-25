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

/** Format an ISO date (YYYY-MM-DD) as "Month DAY, YEAR" in UTC. */
export function formatPublishDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
