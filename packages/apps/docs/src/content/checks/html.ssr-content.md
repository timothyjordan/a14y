---
id: html.ssr-content
title: Initial HTML contains substantive text
group: Content structure
scope: page
why: >
  Many AI crawlers do not execute JavaScript. A single-page app that ships an empty shell and
  hydrates its content on the client is effectively blank to them, even when a browser-based
  renderer like Googlebot can see the full page. Server-rendering the main text is what makes a
  page readable to the widest set of agents.
references:
  - title: "Google: AI optimization guide"
    url: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
  - title: "Google: JavaScript SEO basics"
    url: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
---

> **Status: spec.** This check is pinned in the `0.3.0-draft` scorecard with a placeholder that returns N/A while the detector is implemented. The contract below is what it will assert once detection ships; it does not yet affect your score.

## How the check decides

The check reads the initial HTML response — the bytes the server returns before any client-side JavaScript runs — and measures how much visible text is present after stripping `<script>`, `<style>`, and `<noscript>`. It passes if the server-rendered body already carries the page's substantive content, and fails if the body is an empty shell whose text only appears after hydration.

## How to implement it

Render your main content on the server. Static site generators (Astro, Hugo, Jekyll, Eleventy) do this by default. For React/Vue/Svelte apps, use the framework's SSR or static-export mode (Next.js, Nuxt, SvelteKit, Remix) so the first response contains real text rather than a `<div id="root"></div>` placeholder.

### Pass

```html
<body>
  <main>
    <h1>Install a14y</h1>
    <p>Run <code>npx a14y check &lt;your-site&gt;</code> to score any URL...</p>
  </main>
</body>
```

The text is in the initial response — no JavaScript required to read it.

### Fail

```html
<body>
  <div id="root"></div>
  <script src="/app.js"></script>
</body>
```

The content only exists after `app.js` runs, so a non-JS agent sees nothing.
