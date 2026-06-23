# looksLikeHtml

> Detect whether an HTTP response body is an HTML document rather than the
> plain-text / markdown file we requested.

Given a response `body` (string) and an optional `contentType` (string), decide
whether the response is an HTML page rather than the real text/markdown file at
that path. Used to reject "soft-200" responses (SPA shells or styled 404 pages
served with HTTP 200) so a discovery-file existence check reflects a real file.

## Should

- Return `true` when the body, after ignoring a leading byte-order mark, leading
  whitespace, and a single leading HTML comment, begins with an HTML document
  marker: `<!doctype html`, `<html`, `<head`, or `<body`. Matching is
  case-insensitive (`<!DOCTYPE HTML>` and `<HTML>` count).
- Return `true` when `contentType` indicates HTML (`text/html` or
  `application/xhtml+xml`, possibly with parameters like `; charset=utf-8`) and
  the body's first non-whitespace character is `<`.
- Return `false` for a real text/markdown file even if it is mislabeled with an
  HTML `contentType`: bodies that begin with markdown or plain text such as
  `# Title`, `User-agent: *`, `Hello world`, or `[Docs](/index.md)` are not HTML.
- Return `false` for a markdown file whose first bytes are an HTML comment that
  is then followed by markdown (the comment is stripped before sniffing, so
  `<!-- generated -->\n# Title` is not HTML).
- Return `false` for an empty or whitespace-only body when `contentType` is not
  HTML.
- Treat `contentType` as optional: when it is omitted, decide from the body
  alone.

## Acceptance criteria

- `looksLikeHtml('<!doctype html><html>...')` is `true`.
- `looksLikeHtml('   \n<!DOCTYPE HTML>')` is `true`.
- `looksLikeHtml('<!-- shell -->\n<html><body>')` is `true`.
- `looksLikeHtml('<div id="app"></div>', 'text/html; charset=utf-8')` is `true`.
- `looksLikeHtml('# Sitemap\n- [a](/a.md)', 'text/html')` is `false`.
- `looksLikeHtml('User-agent: *\nAllow: /')` is `false`.
- `looksLikeHtml('<!-- note -->\n# Title')` is `false`.
- `looksLikeHtml('')` is `false`.
