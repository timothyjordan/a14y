---
id: http.no-noindex-noai
title: x-robots-tag does not block agents
group: HTTP
scope: page
why: >
  The X-Robots-Tag header is the response-header equivalent of a meta robots tag.
  Setting noindex, noai, or noimageai on it tells AI ingesters to skip the page entirely
  Often inadvertently, when the directive was meant for a different file type.
references:
  - title: "Google: X-Robots-Tag"
    url: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#xrobotstag
---

## How the check decides

The check reads the response `X-Robots-Tag` header (lowercased) and asserts it does not contain `noindex`, `noai`, or `noimageai`. Passes if the header is absent or contains none of those tokens. Fails (with the offending tokens) otherwise.

## How to implement it

Audit your CDN, edge worker, and origin server config for X-Robots-Tag rules. If you're blocking AI training but not search engines, use a more granular header that targets specific user-agents rather than a blanket noai.

### Pass

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

### Fail

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
X-Robots-Tag: noindex, noai
```
