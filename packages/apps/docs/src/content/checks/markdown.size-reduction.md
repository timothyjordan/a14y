---
id: markdown.size-reduction
title: Markdown mirror is meaningfully smaller than the HTML
group: Markdown mirror
scope: page
why: >
  The reason to publish a markdown mirror is to give agents the same content in
  fewer tokens. A mirror that is the same size as (or larger than) the HTML page is
  not delivering the win, and probably means the mirror is a wrapper around the
  rendered HTML rather than a clean serialisation of the source content.
---

## How the check decides

The check measures `byte_size(html) / byte_size(markdown)` for the same URL. It passes if the markdown body is at least 30% smaller than the HTML body. It fails with the actual reduction percentage if the markdown is less than 30% smaller, and fails with a distinct message if the markdown is larger than the HTML. Returns N/A if no mirror exists, or if the HTML response body is empty.

## How to implement it

If the mirror is bigger than the HTML, the mirror is almost certainly including chrome, scripts, or inlined HTML that should be stripped. See [markdown.navigation-stripped](/checks/markdown.navigation-stripped/) and [markdown.valid-markdown](/checks/markdown.valid-markdown/) for the most common culprits. The cleanest fix is usually to publish the source markdown directly rather than converting from rendered HTML.

### Pass

```text
GET /docs/install      → 8,400 bytes
GET /docs/install.md   → 1,900 bytes   (77.4% smaller)
```

### Fail

```text
GET /docs/install      → 8,400 bytes
GET /docs/install.md   → 7,200 bytes   (only 14.3% smaller; need ≥ 30%)
```
