---
id: html.glossary-link
title: Links to a glossary or terminology page
group: Content structure
scope: page
why: >
  Agents that don't already know your domain vocabulary need a place to look it up.
  A glossary or terminology page linked from every doc page gives them a single
  authoritative source for "what does this term mean in this product".
references:
  - title: "Google: Glossary best practices"
    url: https://developers.google.com/style/glossaries
---

## How the check decides

The check enumerates every `<a>` element on the page and asserts at least one has visible link text matching `glossary` or `terminology` (case-insensitive). Fails if no such link exists.

## How to implement it

Publish a `/glossary/` (or `/terminology/`) page and link to it from your global site footer or sidebar so every page picks the link up automatically.

### Pass

```html
<footer>
  <a href="/glossary">Glossary</a>
  <a href="/about">About</a>
</footer>
```

### Fail

```html
<footer>
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
</footer>
```
