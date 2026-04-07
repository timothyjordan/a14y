---
id: sitemap-md.exists
title: sitemap.md is published
group: Discoverability
scope: site
why: >
  sitemap.md is a human- and agent-readable version of sitemap.xml. It's the same idea as
  sitemap.xml but in the format agents most prefer to ingest, and unlike llms.txt it can
  carry full hierarchical structure with section headings.
references:
  - title: "Agent readability spec"
    url: https://timothyjordan.com/blog/2026/03/23/agent-readability-spec.html
---

## How the check decides

The check sends `GET /sitemap.md`, then `/docs/sitemap.md`, then `/.well-known/sitemap.md`. Passes if any return 2xx. Fails if none do.

## How to implement it

Generate a markdown file alongside your sitemap.xml that mirrors the same URL hierarchy with headings and bullet lists. A simple post-build script that walks your site's pages and emits one bullet per URL is enough.

### Pass

```markdown
# Example Docs

## Getting started
- [Install](/docs/install.md)
- [Quickstart](/docs/quickstart.md)

## Reference
- [API](/docs/api.md)
```

Served at `https://example.com/sitemap.md`.

### Fail

```text
HTTP/1.1 404 Not Found
```
