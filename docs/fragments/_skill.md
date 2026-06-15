## Use from a coding agent

a14y ships an [agent skill](https://agentskills.io/specification) that any spec-compliant coding agent (Claude Code, Codex, Cursor, OpenCode, and 50+ others) can install with one command:

```bash
npx skills add timothyjordan/a14y
```

The a14y CLI can also install, update, and uninstall the skill itself, which is handy if you already have a14y on your `PATH`. It is idempotent (installs if missing, updates if present), auto-detects which coding agents you have configured, and shows a checklist before writing:

```bash
npx -y a14y skill              # install/update for detected agents (~/.claude/skills, ...)
npx -y a14y skill --link       # one shared copy in .agents/skills, symlinked from each agent
npx -y a14y skill --project    # guided install into the current project, so collaborators share it
npx -y a14y skill --check      # report whether your copy is out of date
npx -y a14y skill uninstall    # remove it from every agent and the shared dir
```

Run `a14y skill --project` from inside a repository to commit the skill alongside your code, so everyone working in that repo gets it.

The skill detects a running local dev server (or falls back to your live URL), runs the audit, proposes a prioritized fix plan, and tracks score deltas across runs in `AGENTS.md`. Source: [`skills/a14y/SKILL.md`](./skills/a14y/SKILL.md).

The live site at <https://a14y.dev> also advertises this skill via `<link rel="agent-skills">` and `/.well-known/agent-skills/index.json` per the [Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc), so agents that respect those signals can pick it up automatically.
