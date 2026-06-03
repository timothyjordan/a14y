---
id: discovery.no-duplicate-content
title: No URLs share a canonical with another announced URL
group: Discoverability
scope: site
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

## How the check decides

The check runs once per site, after every page has been fetched. For each crawled URL it records the resolved `<link rel="canonical">` href (falling back to the fetched URL when no canonical is declared), then groups URLs by canonical. The site passes when every canonical is claimed by at most one URL, and fails when two or more URLs collapse to the same canonical — the message names how many duplicate groups were found and shows one example pair. In single-page mode there is no site-wide view, so the check returns N/A.

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
