---
id: sitemap-xml.has-lastmod
title: sitemap entries include <lastmod>
group: Discoverability
scope: site
why: >
  <lastmod> lets agents do incremental re-ingestion — they can skip pages whose lastmod
  hasn't changed since their last crawl. Without it, agents either re-fetch everything every
  time (wasteful) or never update their snapshot (stale).
references:
  - title: "sitemaps.org spec"
    url: https://www.sitemaps.org/protocol.html
---

## How the check decides

After parsing the sitemap, the check inspects every `<url>` entry and counts how many are missing a `<lastmod>` child. Passes if all entries have one. Fails with a count if any are missing. Warns if the sitemap has zero entries. Returns N/A if the sitemap couldn't be parsed at all.

## How to implement it

Most sitemap generators emit `<lastmod>` automatically from the source file mtime or the content's `last_updated` frontmatter. If yours doesn't, populate it from the most recent commit touching each page.

### Pass

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/docs/install</loc>
    <lastmod>2026-04-01</lastmod>
  </url>
</urlset>
```

### Fail

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/docs/install</loc>
  </url>
</urlset>
```
