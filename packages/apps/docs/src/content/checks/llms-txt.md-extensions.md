---
id: llms-txt.md-extensions
title: llms.txt links use .md or .mdx
group: Discoverability
scope: site
why: >
  Markdown URLs are the format agents can ingest cleanly without parsing HTML or executing
  JavaScript. Linking to .html pages from llms.txt forces agents to do the heavy lifting and
  defeats the purpose of having a curated list of agent-friendly URLs.
references:
  - title: "llmstxt.org spec"
    url: https://llmstxt.org
---

## How the check decides

The check parses every markdown link `[label](url)` out of the llms.txt body and inspects each URL's path. It strips any query string or fragment, then asserts the path ends in `.md` or `.mdx`. Passes if every link does. Fails (with a list of offenders) if any don't. Warns if llms.txt has no links to evaluate.

## How to implement it

For every page you list in llms.txt, link to its markdown mirror rather than its HTML page. If you don't yet publish markdown mirrors, see [`markdown.mirror-suffix`](./markdown.mirror-suffix/) for how to add them.

### Pass

```text
# Example Docs
- [Install](https://example.com/docs/install.md)
- [Quickstart](https://example.com/docs/quickstart.mdx)
```

### Fail

```text
# Example Docs
- [Install](https://example.com/docs/install.html)
- [Quickstart](https://example.com/docs/quickstart)
```
