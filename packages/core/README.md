<!-- THIS FILE IS GENERATED. Edit docs/templates/ or docs/fragments/ and run `npm run docs`. -->

# @a14y/core

Scoring engine for [a14y](https://github.com/timothyjordan/a14y) — the agent readability scorer for documentation sites. This package contains the checks, crawler, and report generators; it's what the `a14y` CLI and the Chrome extension call into.

> 📖 **Full documentation & source:** <https://github.com/timothyjordan/a14y>
> 🌐 **Docs site:** <https://timothyjordan.github.io/a14y/>

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

## License

Apache-2.0 © Timothy Jordan
