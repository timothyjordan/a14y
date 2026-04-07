---
id: markdown.alternate-link
title: HTML declares a markdown alternate
group: Markdown mirror
scope: page
why: >
  An agent reading the HTML page should be able to discover the markdown mirror without
  guessing the URL. The standard way to declare it is `<link rel="alternate" type="text/markdown">`.
references:
  - title: "HTML spec: link rel=alternate"
    url: https://html.spec.whatwg.org/multipage/links.html#link-type-alternate
---

## How the check decides

The check queries `link[rel="alternate"][type="text/markdown"]` on the page and asserts a non-empty `href` attribute is present. Fails if no such tag exists.

## How to implement it

Emit a `<link rel="alternate" type="text/markdown">` in your page's `<head>` pointing at the markdown mirror you publish.

### Pass

```html
<head>
  <link rel="alternate" type="text/markdown" href="/docs/install.md">
</head>
```

### Fail

```html
<head>
  <!-- no alternate link -->
</head>
```
