## Use from a coding agent

a14y ships an [agent skill](https://agentskills.io/specification) that any spec-compliant coding agent (Claude Code, Codex, Cursor, OpenCode, and 50+ others) can install with one command:

```bash
npx skills add timothyjordan/a14y
```

The skill detects a running local dev server (or falls back to your live URL), runs the audit, proposes a prioritized fix plan, and tracks score deltas across runs in `AGENTS.md`. Source: [`skills/a14y/SKILL.md`](./skills/a14y/SKILL.md).

The live site at <https://a14y.dev> also advertises this skill via `<link rel="agent-skills">` and `/.well-known/agent-skills/index.json` per the [Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc), so agents that respect those signals can pick it up automatically.
