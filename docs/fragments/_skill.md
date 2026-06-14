## Use from a coding agent

a14y ships an [agent skill](https://agentskills.io/specification) that any spec-compliant coding agent (Claude Code, Codex, Cursor, OpenCode, and 50+ others) can install with one command:

```bash
npx skills add timothyjordan/a14y
```

The a14y CLI can also install and update the skill itself, which is handy if you already have a14y on your `PATH`. It is idempotent (installs if missing, updates if present) and auto-detects which coding agents you have configured:

```bash
npx -y a14y skills            # install/update globally (~/.claude/skills, ...)
npx -y a14y skills --local    # install into the current project instead
npx -y a14y skills --check    # report whether your copy is out of date
```

The skill detects a running local dev server (or falls back to your live URL), runs the audit, proposes a prioritized fix plan, and tracks score deltas across runs in `AGENTS.md`. Source: [`skills/a14y/SKILL.md`](./skills/a14y/SKILL.md).

The live site at <https://a14y.dev> also advertises this skill via `<link rel="agent-skills">` and `/.well-known/agent-skills/index.json` per the [Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc), so agents that respect those signals can pick it up automatically.
