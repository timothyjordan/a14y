# leaderboardPageTitle / leaderboardPageDescription

> Title and meta description for the 326 per-site leaderboard pages at
> `/leaderboard/<slug>/`, written so a searcher looking for a specific site's
> discovery files recognises the result as the answer.

Authored from intent (TJ-1348, TJ-1294) before any test was written. The oracle
comes from what the copy has to achieve in a search result, not from the
implementation.

## Background

These pages carried 61% of the site's search impressions in the 2026-07-30
Search Console export and converted zero clicks, while holding positions as high
as 1.53. The one visible non-brand query was `merriam-webster robots
sitemap.xml`. The old copy (`Merriam-Webster — a14y scorecard`, plus a
description naming only the score) contained none of `robots.txt`,
`sitemap.xml`, `llms.txt`, or `AGENTS.md`. The new copy names them.

## Should: `leaderboardPageTitle(siteName)`

- Contain the site name, unmodified, so the result matches a query that includes
  the brand.
- Name `llms.txt`, `robots.txt`, and `sitemap.xml`, the three terms that
  appeared in real queries.
- Contain the string `a14y`, preserving brand recognition. The brand query is
  the site's best-converting term at 30.3% CTR.
- Introduce no `&` character of its own. The fixed part of the title (what
  remains once the site name is removed) must contain no ampersand, because the
  markdown mirrors read the title back out of rendered HTML where an ampersand
  arrives escaped. An ampersand *inside a site name* is legitimate data and must
  survive verbatim: "McKinsey & Company" is a real catalog entry, and the mirror
  layer is what decodes it back to text.
- Contain no em-dash.
- Be a single line: no newline, no leading or trailing whitespace.
- Stay within a length budget for the real catalog. Across all published
  leaderboard entries, the median length is at or under 60 characters and no
  title exceeds 75. Going a little over 60 is acceptable because Google still
  indexes and matches the full title; a runaway title is not.
- Be injective over distinct site names: two different names never produce the
  same title, so no two pages compete with an identical result.

## Should: `leaderboardPageDescription(siteName, siteUrl, score)`

- Lead with the site name and its score out of 100, because the score is the
  answer this page uniquely has.
- Name all four discovery files: `llms.txt`, `AGENTS.md`, `robots.txt`, and
  `sitemap.xml`.
- Contain the host of `siteUrl` rather than the full URL, so the description
  spends its budget on words rather than on a scheme and path.
- Be a single line with no newline and no leading or trailing whitespace.
- Stay within a length budget for the real catalog: median at or under 160
  characters, and no description over 200.
- Never render `undefined`, `null`, or `NaN` into the output for a score that is
  a real number, including 0 and 100.

## Should: `siteHost(siteUrl)`

- Return the host for an ordinary absolute URL, excluding scheme, path, query,
  and fragment. `https://www.merriam-webster.com/dictionary` yields
  `www.merriam-webster.com`.
- Preserve a port when the URL carries one, since that is part of the host.
- Return the input unchanged rather than throwing when the value cannot be
  parsed as a URL. A slightly odd description is a better outcome than a build
  that dies over a meta tag.

## Notes

- All three functions are pure and total: same arguments, same result, no I/O.
- The catalog is reachable in tests via `getLeaderboard()` from
  `~/lib/research-data`, filtered to published runs via `listSiteRunSlugs()`
  from `~/lib/site-run`. Length budgets should be asserted against those real
  entries, not against invented names.
- Out of scope: whether the copy actually improves CTR, which only Search
  Console can answer, and the body of the markdown mirrors, which TJ-1340 owns.
