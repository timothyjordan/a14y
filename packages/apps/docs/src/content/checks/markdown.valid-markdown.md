---
id: markdown.valid-markdown
title: Markdown mirror is actually markdown
group: Markdown mirror
scope: page
why: >
  Agents trust a `Content-Type: text/markdown` response to be markdown. Serving the
  rendered HTML page with a markdown content type defeats the purpose of having a
  mirror — the agent still has to run an HTML parser and extract the article, and
  the size-reduction win is gone.
---

## How the check decides

The check fetches the markdown mirror and looks for two failure shapes:

1. The body starts with an HTML prologue — `<!doctype html>`, `<html`, or `<?xml`. Fails immediately.
2. More than 30% of the body's characters live inside HTML tags. Fails with the measured ratio.

A body that contains occasional inline tags (`<br>`, `<sup>`, embedded `<img>`) easily passes. Returns N/A if no mirror was published at all.

## How to implement it

Serialise the source markdown directly rather than converting from rendered HTML. If your build pipeline can only post-process HTML, run a real HTML→markdown converter (`turndown`, `pandoc`) rather than just changing the response's content type.

### Pass

```markdown
---
title: Install a14y
---

# Install a14y

Run `npm install -g @a14y/cli`, then `a14y https://example.com` to audit a site.

- Reads `llms.txt` if present.
- Falls back to crawling the sitemap.
```

### Fail

```html
<!doctype html>
<html>
<body><h1>Install a14y</h1>...</body>
</html>
```
