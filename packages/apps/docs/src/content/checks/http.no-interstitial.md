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

> **Status: spec.** This check is pinned in the `0.3.0-draft` scorecard with a placeholder that returns N/A while the detector is implemented. The contract below is what it will assert once detection ships; it does not yet affect your score.

## How the check decides

The check inspects the initial render for a blocking overlay that covers the main content — an open `<dialog>`, a `role="dialog"` element, or a known consent-banner pattern (OneTrust, TrustArc, Cookiebot) paired with a scroll-locked body. It passes when the main content is reachable without dismissing anything, and fails when an interstitial dominates the first render.

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
