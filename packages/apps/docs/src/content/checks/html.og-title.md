---
id: html.og-title
title: Has og:title
group: HTML metadata
scope: page
why: >
  Open Graph tags are the most widely-supported "structured representation of this
  page" mechanism. Even agents that don't speak any other format usually fall back to
  og:title for a clean human-readable name.
references:
  - title: "Open Graph protocol"
    url: https://ogp.me
---

## How the check decides

The check reads the `content` attribute of `<meta property="og:title">` and asserts it is present and non-empty. Fails if the tag is missing or empty.

## How to implement it

Add `<meta property="og:title">` to every page's `<head>`. Most frameworks expose this through their head/SEO component (Astro's `<SEO>`, Next.js's `<Head>`, Hugo's `partials/seo.html`).

### Pass

```html
<meta property="og:title" content="Install a14y">
```

### Fail

```html
<!-- no og:title -->
```
