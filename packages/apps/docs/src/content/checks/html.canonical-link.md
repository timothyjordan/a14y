---
id: html.canonical-link
title: Has <link rel="canonical">
group: HTML metadata
scope: page
why: >
  Agents follow canonical links to deduplicate the same content reachable at multiple
  URLs. Without one, RAG ingesters store the same article under several URLs and waste
  context window capacity.
references:
  - title: "HTML spec: link rel=canonical"
    url: https://html.spec.whatwg.org/multipage/links.html#link-type-canonical
  - title: "Google: Canonical URLs"
    url: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
---

## How the check decides

The check loads the page HTML, queries `link[rel="canonical"]`, and reads the `href` attribute. Passes if a non-empty href is present. Fails otherwise.

## How to implement it

Add a `<link rel="canonical">` to every page's `<head>` pointing at the URL you consider authoritative. Most static-site generators emit this automatically once you configure `site` or `siteUrl` in their config.

### Pass

```html
<head>
  <link rel="canonical" href="https://example.com/docs/intro">
</head>
```

### Fail

```html
<head>
  <!-- no canonical link -->
</head>
```

## Common gotchas

The canonical URL must be **absolute**, a relative href like `/docs/intro` is technically valid HTML but defeats the deduplication purpose because agents see different `href` values from different page contexts. Always emit the fully-qualified URL.

If your site is reachable on both `www` and apex domains, or both `http` and `https`, the canonical href should always point at the version you want indexed. Pick one and stick to it across every page.

Most modern frameworks (Next.js, Astro, Hugo, Docusaurus) emit canonical links automatically once you configure the site URL. If you're hand-rolling templates, add the canonical to your shared `<head>` partial so every page picks it up without per-page boilerplate.
