---
id: sitemap-xml.exists
title: sitemap.xml is published
group: Discoverability
scope: site
why: >
  sitemap.xml is the universal answer to "what URLs exist on this site". Agents and search
  engines both use it as the seed list for crawling, and the a14y crawler will use
  it as the first source of pages to score.
references:
  - title: "sitemaps.org spec"
    url: https://www.sitemaps.org/protocol.html
---

## How the check decides

The check sends `GET /sitemap.xml`, then falls back to `/sitemap_index.xml` and `/sitemap-index.xml`. It passes if any of those return a 2xx response. It fails if none do.

## How to implement it

Serve a sitemap at the root of your site. Most static site generators (Astro, Next.js, Hugo, Jekyll, Docusaurus) have built-in sitemap plugins. If you're rolling your own, the format is well-specified and short.

### Pass

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/docs/install</loc>
    <lastmod>2026-04-01</lastmod>
  </url>
</urlset>
```

### Fail

```text
HTTP/1.1 404 Not Found
```
