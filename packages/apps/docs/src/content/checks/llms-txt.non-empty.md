---
id: llms-txt.non-empty
title: llms.txt is not empty
group: Discoverability
scope: site
why: >
  An empty llms.txt file is worse than no file at all, it tells agents the site authors
  are aware of the standard and have explicitly nothing to say. Real content lets agents
  find your docs.
references:
  - title: "llmstxt.org spec"
    url: https://llmstxt.org
---

## How the check decides

After locating llms.txt, the check trims whitespace from the body and asserts the result is non-empty. Returns N/A if no llms.txt was found at all.

## How to implement it

Put real content in your llms.txt, at minimum a heading and one or more linked pages. The format is markdown-flavoured, so headings, bullet lists, and link syntax all work.

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

## What we measured

The savings come from the contents, not the file.

In our benchmark, an agent that read a populated `llms.txt` used **33% fewer tokens** on the same page (177,735 against 266,591), because the listed links sent it straight to the pages worth reading. An empty file has nothing to send it to, so there is nothing to save.

Worth knowing before you invest in the contents: across four arms, a `<link rel="llms-txt">` tag, a `<link rel="alternate" type="text/markdown">` tag, a visible "For agents" footer link, and no signal at all, the agent fetched `llms.txt` **0 times out of 5**. Only a line in the prompt got it to look.

[Read the study →](/research/llms-txt-linking/)
