---
id: html.json-ld.date-modified
title: JSON-LD declares dateModified
group: Structured data
scope: page
why: >
  dateModified lets agents tell when content has actually changed, which is what makes
  incremental re-ingestion possible. Without it, every refresh of an agent's index has to
  treat the page as new.
references:
  - title: "Schema.org: dateModified"
    url: https://schema.org/dateModified
---

## How the check decides

The check parses every JSON-LD block on the page, walks every node (including arrays and `@graph` children), and asserts at least one node has a non-empty `dateModified` field. Returns N/A if no JSON-LD exists. Fails if JSON-LD exists but no node declares dateModified.

## How to implement it

Include `dateModified` in your top-level JSON-LD object, populated from the source file's last-modified time or your CMS. ISO 8601 format is the safest.

### Pass

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "dateModified": "2026-04-01T12:34:56Z"
}
</script>
```

### Fail

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle"
}
</script>
```
