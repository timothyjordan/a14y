---
id: markdown.canonical-header
title: Markdown mirror sends canonical Link header
group: Markdown mirror
scope: page
why: >
  When an agent fetches the markdown mirror, it needs a way to find its way back to
  the canonical HTML page (for example, to link a citation). The Link header with
  rel="canonical" is the HTTP equivalent of <link rel="canonical"> for non-HTML responses.
references:
  - title: "RFC 8288: Web Linking"
    url: https://datatracker.ietf.org/doc/html/rfc8288
---

## How the check decides

The check inspects the markdown mirror's response `Link` header and asserts it contains a `rel="canonical"` (or `rel=canonical`) parameter. Fails if no Link header is present or it lacks rel=canonical. Returns N/A if no mirror exists.

## How to implement it

Configure the response that serves your `.md` mirrors to emit a `Link` header pointing at the HTML page. On Vercel, Netlify, Cloudflare, etc. this is a one-line custom-headers rule.

### Pass

```text
HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8
Link: <https://example.com/docs/install>; rel="canonical"

# Install a14y
...
```

### Fail

```text
HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8

# Install a14y
...
```
