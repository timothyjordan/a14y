---
id: discovery.no-duplicate-content
title: Page is not a duplicate of another crawled URL
group: Discoverability
scope: page
why: >
  When several URLs serve the same content, an agent spends its limited token budget re-reading
  material it already has, and crawlers waste fetches that could have reached new pages. Google
  raises the same concern for AI search. Collapsing duplicates to a single canonical keeps a site
  cheap to read and unambiguous to cite.
references:
  - title: "Google: AI optimization guide"
    url: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
  - title: "Google: consolidate duplicate URLs"
    url: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
---

> **Status: spec.** This check is pinned in the `0.3.0-draft` scorecard with a placeholder that returns N/A while the detector is implemented. The contract below is what it will assert once detection ships; it does not yet affect your score.

## How the check decides

During a full-site crawl, the check groups every announced URL by the canonical it declares (falling back to the fetched URL when no `<link rel="canonical">` is present). A page passes if its canonical group contains only itself; it fails if two or more distinct announced URLs collapse to the same canonical, which means the site is serving the same content under multiple addresses. In single-page mode there is no site-wide view, so the check returns N/A.

## How to implement it

Pick one canonical URL per piece of content and point every duplicate at it with `<link rel="canonical">`. Common sources of duplicates: trailing-slash vs non-trailing-slash, `http` vs `https`, `www` vs apex, tracking query strings, and printer-friendly variants. Redirect or canonicalize them to a single address, and list only that address in your sitemap and llms.txt.

### Pass

```html
<!-- https://example.com/docs/install/ -->
<link rel="canonical" href="https://example.com/docs/install/">
```

No other announced URL declares this canonical.

### Fail

```html
<!-- https://example.com/docs/install and https://example.com/docs/install/?ref=nav -->
<!-- both return 200 with their own self-referential canonical -->
```

Two announced URLs serve the same page, so an agent reads it twice.
