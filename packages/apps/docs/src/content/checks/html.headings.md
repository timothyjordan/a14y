---
id: html.headings
title: Has at least 3 section headings
group: Content structure
scope: page
why: >
  Headings are how agents (and humans) navigate long documents. Pages without enough
  headings read as a wall of text to embeddings models, which can't tell where one
  section ends and another begins.
references:
  - title: "MDN: Heading elements"
    url: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements
---

## How the check decides

The check counts the number of `<h1>`, `<h2>`, and `<h3>` elements on the page and asserts the total is at least 3.

## How to implement it

Break long pages into sections with descriptive `<h2>` or `<h3>` headings. If your page is too short to need three headings, that's a signal it should probably be merged with sibling content rather than published as a standalone page.

### Pass

```html
<h1>Install agentready</h1>
<h2>Prerequisites</h2>
<h2>From npm</h2>
<h2>From source</h2>
```

### Fail

```html
<h1>Install agentready</h1>
<p>Run npm install agentready.</p>
```

## Common gotchas

The check counts `<h1>`, `<h2>`, and `<h3>` only — `<h4>` through `<h6>` don't count. Most embeddings models care about the top three levels because deeper levels rarely give meaningful semantic boundaries. If you've structured a page with one h1 followed by a flat list of h4s, the check will fail despite the page being well-organised.

Don't pad the page with empty headings just to clear the threshold. If a page genuinely has fewer than three sections, the right move is to either combine it with a sibling page or expand the content so each heading carries its own substantive sub-section. The threshold is a smell test for "is this page navigable", not a checkbox to game.

Frameworks that auto-generate a "Table of Contents" sidebar from headings (Docusaurus, Astro Starlight, Vitepress) inherently encourage authors to use headings well — adopting one of those is often a faster fix than retrofitting headings into existing prose by hand.
