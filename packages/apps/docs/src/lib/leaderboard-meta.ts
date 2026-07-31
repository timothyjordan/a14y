/**
 * Title and meta description for the per-site leaderboard pages at
 * `/leaderboard/<slug>/`.
 *
 * These 326 pages carried 61% of the site's search impressions in the
 * 2026-07-30 Performance export and converted zero clicks. The one
 * visible non-brand query in that export was
 * `merriam-webster robots sitemap.xml`, so people arrive asking which
 * discovery files a specific site publishes. The old copy
 * (`Merriam-Webster — a14y scorecard`, plus a description naming only
 * the score) never used those words, so a searcher scanning results saw
 * a brand name and an unfamiliar numeronym.
 *
 * The copy below names the files, keeps `· a14y` for brand recognition
 * (the brand query is the site's best converter at 30.3% CTR), and
 * leads the description with the score because that is the answer the
 * page uniquely has.
 *
 * Kept in a module rather than inline in the `.astro` page so the
 * length budgets can be asserted directly against the real catalog.
 */

/**
 * The site-level discovery files these pages report on, in the order
 * they appear in the copy. `llms.txt` leads because it is the term with
 * the most search interest and the least universal adoption, so it is
 * the one a reader is most likely to be checking.
 */
export const DISCOVERY_FILES = ['llms.txt', 'AGENTS.md', 'robots.txt', 'sitemap.xml'] as const;

/**
 * Google truncates around these lengths in the results page. Going over
 * is not fatal (the full value is still indexed and matched), so these
 * are budgets to design against rather than hard limits: a long site
 * name must never cause a title to be dropped or mangled.
 */
export const TITLE_BUDGET = 60;
export const DESCRIPTION_BUDGET = 160;

/**
 * `Merriam-Webster: llms.txt, robots.txt and sitemap.xml · a14y`
 *
 * AGENTS.md is deliberately left out of the title and kept in the
 * description: four filenames overruns the budget on most names, and
 * these three are the terms that actually showed up in search.
 *
 * Spelled "and" rather than "&" on purpose. The markdown mirrors read
 * this title back out of the rendered HTML, where an ampersand arrives
 * escaped as `&amp;` and would land in the frontmatter that way.
 */
export function leaderboardPageTitle(siteName: string): string {
  return `${normalizeName(siteName)}: llms.txt, robots.txt and sitemap.xml · a14y`;
}

/**
 * Trim, and flatten any line break to a single space. A `<title>` is
 * displayed with whitespace collapsed, so a padded or multi-line
 * catalog name looks fine in a browser and is easy to miss, but these
 * strings are also written into markdown frontmatter by the mirror
 * layer, where a stray newline breaks the YAML and padding is visible.
 *
 * Runs of ordinary spaces inside the name are deliberately left alone.
 * Collapsing them would make "Acme  Docs" and "Acme Docs" produce the
 * same title, and two pages with identical titles compete against each
 * other in search results.
 */
function normalizeName(siteName: string): string {
  return siteName.replace(/[\n\r\t\f\v\u2028\u2029]+/g, ' ').trim();
}

/**
 * `Merriam-Webster scores 52/100 for agent readability. Does
 *  www.merriam-webster.com publish llms.txt, AGENTS.md, robots.txt and
 *  sitemap.xml? See every check.`
 *
 * The question is honest rather than rhetorical: the page answers it
 * per file, and different sites genuinely publish different subsets.
 */
export function leaderboardPageDescription(
  siteName: string,
  siteUrl: string,
  score: number,
): string {
  const files = `${DISCOVERY_FILES.slice(0, -1).join(', ')} and ${DISCOVERY_FILES.at(-1)}`;
  return (
    `${normalizeName(siteName)} scores ${score}/100 for agent readability. ` +
    `Does ${siteHost(siteUrl)} publish ${files}? See every check.`
  );
}

/**
 * Host portion of a site URL, for the description. Falls back to the
 * raw value if the catalog ever holds something unparseable, since a
 * slightly odd description beats a build that dies over a meta tag.
 */
export function siteHost(siteUrl: string): string {
  try {
    // An empty host counts as a failure to parse, not a success.
    // `example.com:8443` (a scheme-less host:port) parses cleanly with
    // `example.com:` read as the scheme and no host at all, which would
    // put "Does  publish llms.txt" into the description.
    return new URL(siteUrl).host || siteUrl;
  } catch {
    return siteUrl;
  }
}
