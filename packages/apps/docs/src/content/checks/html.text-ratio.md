---
id: html.text-ratio
title: Text-to-HTML ratio is above 15%
group: Content structure
scope: page
why: >
  Pages where the rendered text is a tiny fraction of the HTML byte size are usually
  JavaScript-rendered apps that haven't run yet, or HTML bloated by inline styles and
  framework boilerplate. Either way, an agent reading the static HTML sees mostly noise.
references:
  - title: "Web Almanac: page weight"
    url: https://almanac.httparchive.org/en/2022/page-weight
---

## How the check decides

The check measures the visible text length of `<body>` (whitespace-collapsed) and divides by the raw HTML body length. Passes if the ratio is above 15%. Fails (with the actual percentage) otherwise.

## How to implement it

Two common fixes:

1. **Server-side render or pre-render** if you're shipping a SPA. Agents that don't run JavaScript see only the empty shell otherwise.
2. **Trim inline styles and framework hydration data**. Move CSS to external stylesheets, lazy-load non-critical hydration payloads, and avoid embedding large JSON blobs as inline scripts when a separate `.json` URL would do.

### Pass

A page where rendered body text is, say, 4 KB out of an 18 KB HTML body, about 22%, passes comfortably.

### Fail

A page where the rendered body text is 800 bytes inside a 60 KB HTML shell of inline scripts and styles fails at 1.3%.
