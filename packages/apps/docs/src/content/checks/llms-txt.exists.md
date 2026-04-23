---
id: llms-txt.exists
title: llms.txt is published
group: Discoverability
scope: site
why: >
  An llms.txt file at a well-known location is the agent equivalent of a sitemap. It tells
  AI ingesters what pages on your site are worth reading and gives them a single, deterministic
  starting point for crawling.
references:
  - title: "llmstxt.org spec"
    url: https://llmstxt.org
  - title: "Anthropic: llms.txt"
    url: https://docs.anthropic.com/en/docs/llms-txt
---

## How the check decides

The check sends a `GET` request to `/llms.txt`, then to `/.well-known/llms.txt`, then to `/docs/llms.txt`. If any of those return a 2xx response it passes. If none do, it falls back to the same paths under `llms-full.txt` (the long-form variant). If still nothing answers, the check fails.

## How to implement it

Create a plain-text file named `llms.txt` at the root of your site (or under `/.well-known/`) that lists the pages you want agents to read. Each line is either a markdown link, a section heading, or free text. The format is intentionally simple — agents can parse it without an HTML parser.

### Pass

```text
# Example Docs

## Getting started
- [Install](https://example.com/docs/install.md)
- [Quickstart](https://example.com/docs/quickstart.md)

## Reference
- [API](https://example.com/docs/api.md)
```

Served at `https://example.com/llms.txt`.

### Fail

No file at any of the well-known paths — `GET /llms.txt`, `GET /.well-known/llms.txt`, `GET /docs/llms.txt`, and the `llms-full.txt` variants all return 404.
