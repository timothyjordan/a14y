---
id: http.no-interstitial
title: Content is not gated behind a blocking interstitial
group: HTTP
scope: page
why: >
  A human clicks "Accept all cookies" or dismisses a login modal and reads the page. An AI crawler
  cannot click anything — if the main content sits behind a full-page consent wall, age gate, or
  sign-in modal in the initial render, the agent sees the wall and nothing else. Serving content
  unblocked is what keeps it readable.
references:
  - title: "Google: AI optimization guide"
    url: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
  - title: "Google: intrusive interstitials"
    url: https://developers.google.com/search/docs/appearance/page-experience
---

## How the check decides

The check scans the initial HTML response for three patterns that almost always indicate a blocking overlay:

1. **Named consent platforms** — DOM markers for OneTrust (`#onetrust-consent-sdk`, `.onetrust-pc-dark-filter`), Cookiebot (`#CybotCookiebotDialog`), TrustArc (`#truste-consent-track`, `.truste_overlay`, `.truste_box_overlay`), Sourcepoint (`#cmpwrapper`, `#sp_message_container_1`), and Quantcast Choice (`#qc-cmp2-container`).
2. **`<dialog open>`** — a modal dialog that's already open when the page loads.
3. **Body-level `[role="dialog"]`** — an ARIA dialog mounted directly under `<body>`. Inline dialogs nested under `<article>` or `<main>` are almost always content widgets, not blocking overlays, and don't trigger the check.

It passes when none of the above is present in the initial HTML.

The heuristic is deliberately conservative: only widely-deployed platforms and only their well-known markers, so it doesn't fire on inline cookie banners that don't actually block content.

## How to implement it

Don't require interaction to reveal content. Render the page text normally and layer consent or sign-in prompts as non-blocking elements, or gate them server-side only for the sessions that truly need them. If you must show a cookie banner, keep the underlying content present in the DOM and scrollable rather than hidden behind a modal backdrop.

### Pass

```html
<body>
  <main>...full article text...</main>
  <aside class="cookie-notice">We use cookies. <button>OK</button></aside>
</body>
```

The banner is present but the content is readable underneath it.

### Fail

```html
<body style="overflow:hidden">
  <div role="dialog" class="consent-wall">Accept cookies to continue</div>
  <main hidden>...content the agent never reaches...</main>
</body>
```

The wall blocks the render and the agent can't get past it.
