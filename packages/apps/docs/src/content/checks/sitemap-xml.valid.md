---
id: sitemap-xml.valid
title: sitemap.xml parses as urlset or sitemapindex
group: Discoverability
scope: site
why: >
  A sitemap that doesn't parse is functionally identical to no sitemap at all. This check
  catches the very common case of a sitemap.xml served with the wrong root element or
  malformed XML.
references:
  - title: "sitemaps.org spec"
    url: https://www.sitemaps.org/protocol.html
---

## How the check decides

The check parses the sitemap body with [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) and inspects the root element. Passes if the parsed tree has a `<urlset>` (a regular sitemap) or `<sitemapindex>` (a sitemap index that points at child sitemaps) at its root. Fails if the body isn't valid XML or has neither root element. Returns N/A if no sitemap was found at all.

## How to implement it

Use a known-good sitemap generator rather than templating XML by hand. If you're hand-rolling, double-check namespace declarations and ensure the root element is `<urlset>` or `<sitemapindex>`.

### Pass

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
</urlset>
```

### Fail

```xml
<?xml version="1.0" encoding="UTF-8"?>
<pages>
  <page>https://example.com/</page>
</pages>
```
