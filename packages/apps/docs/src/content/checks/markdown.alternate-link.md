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

## Common gotchas

The href can be **relative** (`/docs/install.md`) or absolute (`https://example.com/docs/install.md`); both satisfy the check. Use whichever your site already prefers for canonical and og links — consistency matters more than the specific form.

Make the alternate-link emission part of your shared layout component so it's set automatically on every page. The alternate's URL should be derived from the current page's URL, not duplicated by hand — otherwise you'll forget to update it when adding a new page or moving an existing one.

The companion check [`markdown.mirror-suffix`](../markdown.mirror-suffix/) verifies the mirror file actually exists at the URL the alternate-link advertises, so adding the link without publishing the mirror still leaves you with a half-fix. Build your mirror generation and your alternate-link emission together.
