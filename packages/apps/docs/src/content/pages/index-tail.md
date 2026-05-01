---
title: a14y · agent readability for the web (tail)
description: Hand-the-fixes-to-a-coding-agent section, used only by the markdown mirror generator.
---

## Hand the fixes to a coding agent

Run with `--output agent-prompt` and you get a Markdown brief any coding
agent can consume directly. Every failure carries the detection rule,
the fix, and a link back to the scorecard page.

### An end-to-end loop

`a14y your-site.com --output agent-prompt` writes a fix-list to stdout
(or pipe it to a file). Drop it into your coding agent of choice.
Re-run with `--fail-under 80` in CI to keep the score climbing.

Every scorecard version stays frozen forever, so historical scores
trend cleanly even as the engine evolves.

The block below is real output from `a14y https://a14y.dev --output
agent-prompt`. The site is its own first benchmark.

```
% a14y https://a14y.dev --output agent-prompt
# Agent readability fix-list — https://a14y.dev/

You are an autonomous coding agent. The a14y scorecard
ran against https://a14y.dev/ on 2026-04-30 and identified
3 distinct failing checks across 1 page. Score: 92/100.

After applying fixes, re-run the audit to verify:

  a14y check https://a14y.dev/ --mode page

## Snapshot

- Score:      92/100
- Mode:       page
- Scorecard:  v{{LATEST_VERSION}} (released {{RELEASED_AT}})
- Failed:     3 (3 unique, 3 instances)
- Passed:     33     N/A: 2

## Failing checks

### 1. code.language-tags — 1 page
- What it checks: code blocks declare a language
- Sample message: 1/1 blocks missing language
- Docs: https://a14y.dev/scorecards/{{LATEST_VERSION}}/checks/code.language-tags/

### 2. markdown.canonical-header — 1 page
- Sample: no Link header
- Docs: https://a14y.dev/scorecards/{{LATEST_VERSION}}/checks/markdown.canonical-header/

### 3. markdown.content-negotiation — 1 page
- Sample: text/html; charset=utf-8
```
