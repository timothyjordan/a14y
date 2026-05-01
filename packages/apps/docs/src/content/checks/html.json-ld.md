---
id: html.json-ld
title: Has parseable JSON-LD block
group: Structured data
scope: page
why: >
  JSON-LD is the richest machine-readable format an HTML page can carry. A page with
  JSON-LD can declare its type, author, dates, breadcrumbs, and relationships to other
  pages, all in one block agents can read with a JSON parser instead of HTML scraping.
references:
  - title: "JSON-LD spec"
    url: https://www.w3.org/TR/json-ld11/
  - title: "Schema.org"
    url: https://schema.org
---

## How the check decides

The check finds every `<script type="application/ld+json">` on the page, attempts to `JSON.parse()` each block, and asserts at least one parses successfully. Fails if no block exists or none parse.

## How to implement it

Add at least one `<script type="application/ld+json">` to your `<head>` declaring the page's `@type` and core fields. Most CMS and SSG SEO plugins emit this automatically once you've configured the site.

### Pass

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "headline": "Install a14y",
  "dateModified": "2026-04-01"
}
</script>
```

### Fail

```html
<!-- no JSON-LD block -->
```
