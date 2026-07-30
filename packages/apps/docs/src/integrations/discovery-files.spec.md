# discoveryFilesIntegration

> Astro integration that writes the site-level discovery files into `public/` at
> `astro:config:setup`: `llms.txt`, `robots.txt`, `sitemap.xml`, `sitemap.md`,
> `AGENTS.md`, and the `.well-known/agent-skills/` surface.

Authored from intent (TJ-1337, TJ-1293) before any test was written. The oracle
comes from what these files are supposed to advertise, not from what the current
code emits.

## Background

These files are how search engines and AI agents discover the site. They were
generated from a hardcoded path array that had drifted badly: `sitemap.xml`
listed 95 URLs while the site served roughly 425. The pages the business cared
most about (`/research/` articles, the whole `/leaderboard/`) were the ones
missing. The URL list now comes from `listSiteRoutes()`.

## Should

- Write `sitemap.xml` announcing exactly the paths `listSiteRoutes()` returns:
  one `<url><loc>` per path, prefixed with the origin `https://a14y.dev`, each
  with a `<lastmod>`. The document parses as XML and the `<loc>` count equals the
  route count.
- Announce well over 400 URLs in `sitemap.xml`, including `/leaderboard/` and at
  least 300 `/leaderboard/<slug>/` URLs, rather than the 95 it replaced.
- Write `sitemap.md` linking every route to its markdown mirror (`/foo/` →
  `/foo.md`, `/` → `/index.md`), grouped under a heading per top-level section,
  with `## Leaderboard` and `## Research` sections present.
- Link, from `sitemap.md`, only markdown mirrors that correspond to a route in
  `listSiteRoutes()`, so no discovery surface points at a page that will not be
  built.
- List every research article in `llms.txt` by its real title, one entry per
  `/research/<slug>/` route, pointing at `/research/<slug>.md`. Case-study
  articles take the title from their published snapshot; standalone articles take
  it from `research-meta`. No research article is listed under a bare or
  humanized slug, which would mean a new article shipped without a title.
- Link `/leaderboard.md` from `llms.txt` but not the 300+ per-site leaderboard
  pages. `llms.txt` is an index agents read start to finish, so the per-site
  pages are left to the full-sitemap pointer the file already carries, and the
  file stays under roughly 200 lines.
- Write `robots.txt` containing `User-agent: *`, `Allow: /`, and
  `Sitemap: https://a14y.dev/sitemap.xml`, so every crawler including the AI
  crawlers is allowed and can find the sitemap.
- Escape XML metacharacters in any URL written into `sitemap.xml`, so the
  document stays well-formed regardless of slug content.

## Notes

- The integration is invoked by calling `integration.hooks['astro:config:setup']`
  with `{ config: { publicDir } }`, where `publicDir` is a `file://` URL. Tests
  can point it at a temp directory.
- Out of scope: the `.well-known/agent-skills/` surface, already covered by
  `test/agent-skills-discovery.test.ts`.
