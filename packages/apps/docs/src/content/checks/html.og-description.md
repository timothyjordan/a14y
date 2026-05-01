---
id: html.og-description
title: Has og:description
group: HTML metadata
scope: page
why: >
  og:description is the partner of og:title and serves the same purpose, a clean,
  structured summary that agents can read without parsing the body. It's the difference
  between an agent showing your page as a one-line preview versus a URL.
references:
  - title: "Open Graph protocol"
    url: https://ogp.me
---

## How the check decides

The check reads the `content` attribute of `<meta property="og:description">` and asserts it is present and non-empty. Fails if the tag is missing or empty.

## How to implement it

Add `<meta property="og:description">` to every page's `<head>`. It's fine for it to be the same string as `<meta name="description">`; what matters is that both are populated.

### Pass

```html
<meta property="og:description"
      content="Install a14y in under a minute and audit your first site.">
```

### Fail

```html
<!-- no og:description -->
```
