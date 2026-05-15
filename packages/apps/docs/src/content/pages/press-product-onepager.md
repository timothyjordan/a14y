---
title: a14y in one page · press kit
description: A one-page product description of a14y for journalists, podcast bookers, and analysts. Covers the problem, the spec, the scorecard, the tools, and the proof.
---

**The problem.** AI agents (ChatGPT, Claude, Copilot, Cursor, and the
50-plus coding assistants behind them) now read most of the web before
humans do. Yet the web was built for human eyes: layout-driven HTML,
JavaScript-rendered widgets, cookie walls, and broken markdown all
degrade how well an agent can fetch a page, understand it, and act on
it. There is no agreed-upon way to measure how readable a website is
to those agents, and no public scoreboard pushing the industry to
improve.

**The spec.** a14y (shorthand for *agentreadability*) is an open spec
for making any website discoverable, parseable, and comprehensible to
AI agents. The spec is versioned, every check is documented with the
*why* and the *how to fix*, and the whole thing is licensed Apache-2.0
and lives on GitHub. Documentation sites are the high-value first
target, but the scorecard works for marketing sites, product pages,
help centers, and anything else agents might read.

**The scorecard.** Each spec version pins a fixed set of checks across
three categories (Discoverability, Parsing, and Comprehension), so a
score comparison across two sites or two points in time is always
apples-to-apples. The current version (v0.2.0) ships 38 checks; the
scorecard surface at [a14y.dev/scorecards/](https://a14y.dev/scorecards/)
shows every one of them with detection rules and remediation guidance.

**The tools.** Three surfaces, one engine: a free CLI (`npx a14y
your-site.com`), a free [Chrome extension](https://chromewebstore.google.com/detail/a14y-agent-readability/gkkhpjiicjfoblocffiigpbbphbbojom),
and a coding-agent skill (`npx skills add timothyjordan/a14y`) that
drives the audit-and-fix loop inside Claude Code, Codex, Cursor, and
any other spec-compliant agent. All three produce the same score for
the same URL and scorecard version. The CLI also emits a Markdown
fix-list (`--output agent-prompt`) that any agent can ingest
directly.

**The proof.** The public leaderboard at
[a14y.dev/leaderboard/](https://a14y.dev/leaderboard/) scores a
cross-section of major websites against the current scorecard, with
per-site scorecards, a score histogram, and category breakdowns. It
updates as the dataset is refreshed, and every score on the
leaderboard is reproducible by running the open CLI against the same
URL.

**The frame.** YSlow made performance visible; Lighthouse made
performance a checklist; a14y is the same kind of free, opinionated,
embarrassing-in-a-good-way scorecard for the agent-readable web. Open
implementation and an open dataset mean nobody owns the number. Anyone
can verify, dispute, or extend it.
