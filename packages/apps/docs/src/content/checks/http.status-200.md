---
id: http.status-200
title: Page returns HTTP 200
group: HTTP
scope: page
why: >
  A page that doesn't return 200 isn't a page — it's a 404, a 5xx, or an unintended
  redirect target. Agents that follow links to non-200 pages waste context on error
  bodies they can't ingest.
references:
  - title: "MDN: HTTP response status codes"
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
---

## How the check decides

After following any redirects, the check inspects the final response status. Passes if it is exactly 200. Fails with the actual status otherwise.

## How to implement it

Make sure every URL listed in your sitemap or linked from your pages resolves to a 200. Audit your site for broken internal links periodically — `agentready check --mode site` will surface every non-200 page in one pass.

### Pass

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

### Fail

```text
HTTP/1.1 404 Not Found
```
