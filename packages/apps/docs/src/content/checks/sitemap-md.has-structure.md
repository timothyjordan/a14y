---
id: sitemap-md.has-structure
title: sitemap.md has headings and links
group: Discoverability
scope: site
why: >
  An empty sitemap.md or one with only prose is no more useful than a 404. The minimum
  shape that makes a markdown sitemap actually navigable is at least one heading and at
  least one link.
references:
  - title: "Agent readability spec"
    url: https://timothyjordan.com/blog/2026/03/23/agent-readability-spec.html
---

## How the check decides

After fetching sitemap.md, the check counts heading lines (`^#+\s`) and markdown link occurrences. Passes if there is at least one of each. Fails otherwise. Returns N/A if no sitemap.md was found at all.

## How to implement it

Use markdown headings to express categories and bullet lists of links to express the pages within each category. Even a flat list with one heading is enough to pass — the check is intentionally permissive about structure depth.

### Pass

```markdown
# Example Docs

## Pages
- [Install](/docs/install.md)
- [Quickstart](/docs/quickstart.md)
```

### Fail

```markdown
This is the Example Docs sitemap. Please check back later for content.
```
