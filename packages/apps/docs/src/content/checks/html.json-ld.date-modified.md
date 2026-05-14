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

The check parses every JSON-LD block on the page, walks every node (including arrays and `@graph` children), and looks for a `dateModified` field whose value parses as a schema.org `Date` (`YYYY-MM-DD`) or `DateTime` (date + time + timezone designator). The timezone designator may use either the extended form (`+00:00`) or the basic form (`+0000`); both are valid ISO 8601. Returns N/A if no JSON-LD exists. Fails if JSON-LD exists but no node declares `dateModified`, or if every value present is not a valid date string. Calendar-impossible values like `2026-02-30` are rejected.

## How to implement it

Include `dateModified` in your top-level JSON-LD object, populated from the source file's last-modified time or your CMS, formatted as ISO 8601 (`YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SSZ`).

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

```html
<!-- present but unparseable -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "dateModified": "yesterday"
}
</script>
```
