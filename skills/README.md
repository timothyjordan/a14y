# a14y agent skills

Reusable [agent skills](https://agentskills.io/specification) for working with [a14y](https://a14y.dev). Each subdirectory is a single skill following the open `SKILL.md` format and works with any spec-compliant coding agent (Claude Code, Codex, Cursor, OpenCode, and 50+ others).

## Install

```sh
# All skills from this repo
npx skills add timothyjordan/a14y

# Just the a14y audit skill
npx skills add timothyjordan/a14y --skill a14y
```

The [`skills` CLI](https://github.com/vercel-labs/skills) installs into the right directory for whichever coding agent it detects (`~/.claude/skills`, `~/.codex/skills`, `.cursor/rules/`, etc.).

## Available skills

| Skill | What it does |
|---|---|
| [`a14y`](./a14y/SKILL.md) | Audit a website with the a14y CLI, propose a prioritized fix plan, and track score improvements over time. Auto-detects local dev servers and live URLs. |

## Discovery

The live site exposes these skills at `/.well-known/agent-skills/index.json` per the [Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc), and every page on <https://a14y.dev> advertises them via `<link rel="agent-skills">`. Coding agents that respect those signals can pick them up without any manual install step.
