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
