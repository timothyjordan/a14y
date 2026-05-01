---
id: discovery.indexed
title: Page is indexed by sitemap, llms.txt, or sitemap.md
group: Discoverability
scope: page
why: >
  A page that exists but isn't announced anywhere is an orphan, agents can only reach
  it by crawling links from another page. Orphan pages drop out of RAG indexes, search
  results, and any incremental re-ingestion that starts from the announced URL set.
references:
  - title: "sitemaps.org spec"
    url: https://www.sitemaps.org/protocol.html
---

## How the check decides

This check is only meaningful in whole-site mode, it relies on the runner having already collected the union of URLs announced by sitemap.xml, llms.txt, and sitemap.md (stored under the `discovery:indexed-set` shared key). It asserts the current page URL is in that set. Fails if the page was reached only by link crawling (orphaned). Returns N/A in single-page mode, since there's no site-wide index to compare against.

## How to implement it

If a page of yours is flagged as orphaned, add it to **at least one** of your seed files:

- **sitemap.xml**, the most universal. Add a `<url><loc>https://example.com/the-orphan</loc></url>` entry.
- **llms.txt**, link to the page's markdown mirror.
- **sitemap.md**, add the page to the relevant section's bullet list.

Automate this. If you're hand-maintaining any of these files, you will forget, and orphans will accumulate.

### Pass

The page URL appears in the published sitemap.xml (or llms.txt, or sitemap.md).

### Fail

The page is reachable only via an `<a>` link from another page, but none of the sitemap/llms.txt/sitemap.md files mention it.
