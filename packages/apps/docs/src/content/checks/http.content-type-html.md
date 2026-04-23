---
id: http.content-type-html
title: Content-Type is text/html; charset=utf-8
group: HTTP
scope: page
why: >
  Agents sniff content type from the header before deciding how to parse a response.
  A page served with text/plain or no charset can be misinterpreted, especially when
  the body contains non-ASCII characters.
references:
  - title: "MDN: Content-Type"
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
---

## How the check decides

The check reads the response `Content-Type` header (lowercased) and asserts it contains both `text/html` and `utf-8`. Fails with the actual value (or `(missing)`) otherwise.

## How to implement it

Configure your web server or CDN to serve `.html` files with `Content-Type: text/html; charset=utf-8`. Most platforms do this by default; explicit declarations matter when you've put the page behind a custom rewrite or worker.

### Pass

```text
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

### Fail

```text
HTTP/1.1 200 OK
Content-Type: text/html
```
