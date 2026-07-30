# listSiteRoutes

> Returns every canonical URL the a14y docs site publishes, so the discovery
> files (`sitemap.xml`, `sitemap.md`, `llms.txt`) announce the whole site rather
> than a hand-maintained subset of it.

Authored from intent (TJ-1337, TJ-1293) before any test was written. The oracle
below comes from what the site is supposed to publish, not from what the current
code happens to emit.

## Background

The discovery files used to be generated from a hardcoded array of URL paths.
The array drifted from reality: 95 of roughly 425 live pages were announced.
`/leaderboard/` and its per-site pages, `/badge/`, `/badge/how-to-embed/`,
`/scorecards/scoring/`, `/scorecards/<version>/changes/`, and four of the five
`/research/` articles all returned 200 in production while appearing in no
discovery surface. This unit derives routes from `src/pages/` instead of
restating them, so a new page cannot silently fall out of discovery again.

## Should

- Return only absolute, trailing-slashed paths: every element starts with `/` and
  ends with `/`, and the landing page is exactly `/`.
- Never return a duplicate path.
- Never return a path containing `[` or `]`. Every dynamic route is expanded to
  concrete paths, so a caller can put any element straight into a `<loc>`.
- Include every static page found under `src/pages/`, discovered from the
  filesystem rather than declared. In particular `/`, `/badge/`,
  `/badge/how-to-embed/`, `/leaderboard/`, `/research/`, `/scorecards/`,
  `/scorecards/scoring/`, `/spec/`, `/glossary/`, `/press/`, `/privacy/`,
  `/release-notes/`, and `/chrome-extension/`.
- Include a `/research/<slug>/` entry for every `src/pages/research/*.astro` page
  other than `index.astro`. This is the regression that motivated the work: four
  of the five research articles were missing from every discovery surface.
- Include a `/leaderboard/<slug>/` entry for each leaderboard entry whose site run
  has been published, and no entry for a leaderboard entry without a published
  run. The route's own `getStaticPaths` filters on published runs, so announcing
  an unpublished slug would advertise a URL that 404s.
- Include, for every scorecard returned by `listAllScorecards()`,
  `/scorecards/<version>/`, `/scorecards/<version>/changes/`, and
  `/scorecards/<version>/checks/<id>/` for each check id in that scorecard.
- Exclude the `/scorecards/draft/` alias and everything beneath it. That alias
  renders content identical to the current `-draft` version, so announcing both
  would publish duplicate pages to search engines.
- Throw when `src/pages/` contains a route with a `[param]` segment that has no
  registered path expander, with a message naming the offending route pattern.
  Silently returning a partial list would reintroduce the exact drift this unit
  exists to prevent.
- Return an equal list on repeated calls, with `/` first and the rest in a
  deterministic order.

## Notes

- The result is a `string[]`.
- The function reads the filesystem and the site's data loaders. It takes no
  arguments, so there is no malformed-input domain to explore.
- Out of scope: whether search engines actually index the pages.

---

# listLeaderboardSlugs

> Returns the slug of every leaderboard site that actually builds a
> `/leaderboard/<slug>/` page: the leaderboard entries whose full site run has
> been published.

Authored from intent (TJ-1338) before any test was written. This is the single
source of truth shared by the `/leaderboard/[slug]/` sitemap expander and the
`/research/<slug>/` redirect map, so both agree on exactly which sites exist.

## Should

- Return a `string[]` of bare slugs (no leading slash, no `/leaderboard/`
  prefix, no trailing slash).
- Include a slug for each leaderboard entry whose site run is published, and no
  slug for a leaderboard entry without a published run. Same filter the
  `/leaderboard/[slug]/` route's `getStaticPaths` applies.
- Match the `/leaderboard/<slug>/` paths that `listSiteRoutes()` emits, one to
  one: for each announced `/leaderboard/<slug>/` there is exactly one slug here,
  and vice versa.
- Contain no duplicates.
- Throw when the leaderboard has entries but no site run resolves as published,
  which signals the runs directory failed to load rather than that every site is
  genuinely unpublished. Returning an empty list would silently drop every
  per-site page.

# listResearchRedirects

> Returns the redirect map from the old `/research/<slug>/` per-site URLs to
> their new `/leaderboard/<slug>/` homes, as an object of `{ from: to }` string
> pairs.

Authored from intent (TJ-1338) before any test was written. The per-site pages
were renamed from `/research/<slug>/` to `/leaderboard/<slug>/` (TJ-439); Google
still crawls the old URLs and reports them as 404. Each old URL must redirect to
its new home so search engines consolidate onto the live page.

## Should

- Return an object whose keys are old `/research/<slug>/` paths and whose values
  are the corresponding `/leaderboard/<slug>/` paths. Every key starts with
  `/research/` and ends with `/`; every value starts with `/leaderboard/` and
  ends with `/`.
- For a key `/research/<slug>/`, the value is exactly `/leaderboard/<slug>/`
  (same slug on both sides).
- Include an entry for every published leaderboard slug (see
  `listLeaderboardSlugs`), so an old per-site URL for any current site redirects
  rather than 404s.
- Point every value at a URL that `listSiteRoutes()` actually publishes. A
  redirect whose target does not exist would send a crawler from one 404 to
  another.
- Never use a key that collides with a real `/research/` article page (the
  static `src/pages/research/*.astro` routes such as `/research/web/`). A site
  slug that happened to match an article name must not shadow the article with a
  redirect.
- Keep the source `/research/<slug>/` URLs out of `listSiteRoutes()`: a redirect
  is not a page to announce in the sitemap.

## Notes

- Both functions take no arguments and read the filesystem and data loaders.
- Out of scope: the HTML of the emitted redirect stub (Astro renders that from
  the config `redirects` map); this unit only produces the map.
