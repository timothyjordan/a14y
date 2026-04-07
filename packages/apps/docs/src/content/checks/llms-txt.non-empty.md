---
id: llms-txt.non-empty
title: llms.txt is not empty
group: Discoverability
scope: site
why: >
  An empty llms.txt file is worse than no file at all — it tells agents the site authors
  are aware of the standard and have explicitly nothing to say. Real content lets agents
  find your docs.
references:
  - title: "llmstxt.org spec"
    url: https://llmstxt.org
---

## How the check decides

After locating llms.txt, the check trims whitespace from the body and asserts the result is non-empty. Returns N/A if no llms.txt was found at all.

## How to implement it

Put real content in your llms.txt — at minimum a heading and one or more linked pages. The format is markdown-flavoured, so headings, bullet lists, and link syntax all work.

### Pass

```text
# Example Docs

- [Install](https://example.com/docs/install.md)
- [Quickstart](https://example.com/docs/quickstart.md)
```

### Fail

```text

```

(A file that exists but contains only whitespace.)
