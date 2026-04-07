---
id: markdown.content-negotiation
title: Server returns markdown for Accept text/markdown
group: Markdown mirror
scope: page
why: >
  Some agents prefer to ask for markdown with an Accept header rather than guess a URL.
  Honoring Accept lets a single canonical URL serve both HTML and markdown depending on
  who's asking, without forcing the agent to know the .md mirror convention.
references:
  - title: "MDN: Content negotiation"
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation
---

## How the check decides

The check refetches the page URL with `Accept: text/markdown` and inspects the response's `Content-Type`. Passes if it contains `text/markdown` or `text/x-markdown`. Fails (with the actual content type) otherwise. Returns `error` if the request itself fails.

## How to implement it

Add a content-negotiation layer in your edge or origin server: when `Accept` includes `text/markdown`, serve the `.md` mirror's body with `Content-Type: text/markdown; charset=utf-8`. On Cloudflare Workers / Vercel Edge / Netlify Edge this is ~10 lines of code.

### Pass

```text
GET /docs/install
Accept: text/markdown

HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8

# Install agentready
...
```

### Fail

```text
GET /docs/install
Accept: text/markdown

HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!doctype html>...
```
