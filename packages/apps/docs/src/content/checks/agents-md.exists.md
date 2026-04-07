---
id: agents-md.exists
title: AGENTS.md (or equivalent) is published
group: Discoverability
scope: site
why: >
  AGENTS.md (and its many siblings — CLAUDE.md, .cursorrules, .cursor/rules) is the
  agent equivalent of a project README. It's the file an AI coding agent reads first to
  learn how this codebase or product wants to be used.
references:
  - title: "Agents.md spec"
    url: https://agents.md
  - title: "Anthropic: CLAUDE.md"
    url: https://docs.anthropic.com/en/docs/claude-code/memory
---

## How the check decides

The check tries `GET` on each of these paths in order: `/AGENTS.md`, `/agents.md`, `/.well-known/agents.md`, `/docs/AGENTS.md`, `/llms-full.txt`, `/CLAUDE.md`, `/.cursor/rules`, `/.cursorrules`. Passes the first time any of them returns 2xx. Fails if all eight are missing.

## How to implement it

Pick the convention that fits your tooling — `AGENTS.md` is the most universal — and put it at the root of your site. The file should answer "what is this", "how do I install / configure / use it", and "what are the conventions I should follow".

### Pass

```markdown
# Example Project

## Installation
Run `npm install example`.

## Usage
Import the default export and call `example()`.
```

Served at `https://example.com/AGENTS.md`.

### Fail

`GET /AGENTS.md`, `/CLAUDE.md`, `/.cursorrules` etc. all return 404.
