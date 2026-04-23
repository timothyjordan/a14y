# @a14y/core

Scoring engine for [a14y](https://github.com/timothyjordan/a14y) — agent readability for the web. This package contains the checks, crawler, and report generators; it's what the `a14y` CLI and the Chrome extension call into to evaluate any website against the versioned a14y scorecard.

<!-- include: fragments/_links.md -->

## Install

```bash
npm install @a14y/core
```

## Usage

```ts
import { validate, runToAgentPrompt } from '@a14y/core';

const run = await validate({ url: 'https://example.com', mode: 'site' });
console.log(run.summary.score);              // overall 0–100 score
console.log(runToAgentPrompt(run));          // Markdown fix-list for a coding agent
```

See the exports of `@a14y/core` for the full API — `validate`, `crawlSite`, `listScorecards`, `LATEST_SCORECARD`, `runToAgentPrompt`, and the associated TypeScript types.

<!-- include: fragments/_license.md -->
