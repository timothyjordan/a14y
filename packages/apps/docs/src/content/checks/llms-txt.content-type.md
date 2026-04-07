---
id: llms-txt.content-type
title: llms.txt is served as text/plain
group: Discoverability
scope: site
why: >
  Agents identify llms.txt by both location AND content type. Serving it as text/html or
  application/octet-stream causes some ingesters to skip the file or treat it as a binary,
  which defeats the point of having it.
references:
  - title: "llmstxt.org spec"
    url: https://llmstxt.org
  - title: "MDN: Content-Type"
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
---

## How the check decides

After locating the llms.txt file, the check reads its `Content-Type` response header. It passes if the value contains `text/plain` (case-insensitive). It returns a warning otherwise. If no llms.txt is published it returns N/A so it doesn't double-count against the score.

## How to implement it

Configure your web server or static host to serve `.txt` files with `Content-Type: text/plain; charset=utf-8`. Most static hosts (Vercel, Netlify, GitHub Pages, S3) do this by default for `.txt` files; check your custom redirects or rewrites if you've put llms.txt behind one.

### Pass

```text
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8

# Example Docs
- [Install](https://example.com/docs/install.md)
```

### Fail

```text
HTTP/1.1 200 OK
Content-Type: application/octet-stream

# Example Docs
- [Install](https://example.com/docs/install.md)
```
