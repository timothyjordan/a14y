<!-- THIS FILE IS GENERATED. Edit docs/templates/ or docs/fragments/ and run `npm run docs`. -->

# a14y

**Agent readability for the web.** Agents (ChatGPT, Claude, Copilot, Cursor) now read most of the web before humans do. `a14y` (shorthand for *agentreadability*) is an open spec for making any website discoverable, parseable, and comprehensible to those agents, a versioned scorecard that operationalizes the spec, and a CLI plus Chrome extension that score any site against it. Documentation sites are a common high-value target, but the scorecard works for marketing sites, product pages, help centers, and anything else agents might read.

> 📖 **Full documentation & source:** <https://github.com/timothyjordan/a14y>
> 🌐 **Docs site:** <https://a14y.dev>

## Install

```bash
# One-shot
npx a14y https://example.com

# Install globally
npm install -g a14y
a14y https://example.com
```

The CLI also ships under two alias names for discoverability: `agentready` and `agentreadability`. All three run the same binary.

## Usage

```bash
a14y <url>                           # audit a single page
a14y <url> --mode site               # crawl the whole site
a14y <url> --output json             # machine-readable scorecard
a14y <url> --output agent-prompt     # Markdown fix-list for a coding agent
a14y scorecards                      # list available scorecard versions
```

`check` is the default command: `a14y <url>` is exactly the same as `a14y check <url>`. For full flag documentation run `a14y --help` (summary) or `a14y help check` (detail).

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

## Command reference

The sections below are generated from the CLI's own `--help` output, so they stay in sync with the code.

### `a14y --help`

```text
Usage: a14y [options] [command]

Agent readability scorer — audits any website against the versioned a14y
scorecard

Options:
  -V, --version              output the version number
  --no-telemetry             disable anonymous usage telemetry for this run
  -h, --help                 display help for command

Commands:
  check [options] <url>      Audit a URL or whole site against the a14y
                             scorecard
  scorecards [options]       List every shipped scorecard version and the
                             checks each one pins
  skills [options] [action]  Install or update the a14y agent skill for your
                             coding agents (idempotent)
  help [command]             display help for command

Commands in detail:
  check <url>                   Audit a URL or a whole site
    -m, --mode page|site          default: page
    -s, --scorecard <version>     scorecard version, or "draft" for the in-progress one.
                                  Repeat to score the same scan against multiple scorecards
                                  in one invocation, e.g. -s 0.2.0 -s draft
    --max-pages <n>               default: 500
    --concurrency <n>             default: 8
    --page-check-concurrency <n>  default: 4
    --polite-delay <ms>           default: 250
    -o, --output <format>         text | json | agent-prompt
                                  (multi-scorecard runs require text or json)
    --fail-under <score>          exit 1 if first scorecard's final score < threshold
    --no-share                    omit the shareable score block (single scorecard only)
    -v, --verbose                 stream progress events to stderr

  scorecards                    List shipped scorecard versions
    -o, --output <format>         text | json

  skills [update]               Install or update the a14y agent skill (idempotent)
    --global                      install to the home dir (default)
    --local, --project            install into the current project instead
    --target <dir>                write to <dir>/a14y/SKILL.md, skip auto-detect
    --agent <name>                restrict to one agent (repeatable)
    --check, --dry-run            report drift without writing (exit 1 on drift)
    --force                       overwrite a user-modified target or symlink
    -y, --yes                     install to all detected agents (no checklist)
    -o, --output <format>         text | json

Run 'a14y help <command>' (or 'a14y <command> --help') for full details.
Tip: 'check' is the default — 'a14y <url>' works the same as 'a14y check <url>'.
```

### `a14y help check`

```text
Usage: a14y check [options] <url>

Audit a URL or whole site against the a14y scorecard

Options:
  -m, --mode <mode>             page or site (default: "page")
  -s, --scorecard <version>     scorecard version to evaluate against, or
                                "draft" for the in-progress scorecard. Repeat
                                the flag to score the same scan against
                                multiple scorecards in one invocation. Defaults
                                to "0.2.0".
  --max-pages <n>               maximum pages to crawl in site mode (default:
                                500)
  --concurrency <n>             parallel fetches during crawling (default: 8)
  --page-check-concurrency <n>  parallel page-check evaluations (lower bounds
                                peak memory on huge sites) (default: 4)
  --polite-delay <ms>           minimum delay between request starts (default:
                                250)
  -o, --output <format>         text, json, or agent-prompt (default: "text")
  --fail-under <score>          exit 1 if the final score is below this
                                threshold
  --no-share                    omit the shareable score block from text output
  -v, --verbose                 stream progress events to stderr
  -h, --help                    display help for command
```

### `a14y help scorecards`

```text
Usage: a14y scorecards [options]

List every shipped scorecard version and the checks each one pins

Options:
  -o, --output <format>  text or json (default: "text")
  -h, --help             display help for command
```

## Repository layout

This repo is an npm workspace:

- `packages/apps/cli` — the `a14y` binary (this CLI).
- `packages/core` — `@a14y/core`, the library that implements scoring, crawling, and report generation. Consumed by the CLI and by the Chrome extension.
- `packages/apps/extension` — Chrome extension. Released as a `.zip` attached to each `extension-v<version>` GitHub Release (not on npm); see [RELEASING.md](./RELEASING.md).
- `packages/apps/docs` — Astro site published at <https://a14y.dev>.
- `packages/aliases/*` — thin wrapper packages that re-export the CLI under `agentready` and `agentreadability`.

## Contributing

```bash
npm install
npm run build
npm test
npm run docs     # regenerate every README from docs/
```

All user-facing READMEs in this repo (this one, `packages/apps/cli/README.md`, `packages/core/README.md`, and the alias READMEs) are generated from `docs/templates/` + `docs/fragments/`. Edit the source files and run `npm run docs` — never hand-edit a generated README.

For contribution conventions (branching, tests, PR flow) see [CONTRIBUTING.md](./CONTRIBUTING.md). For the release flow (npm packages, Chrome extension, docs site) see [RELEASING.md](./RELEASING.md).

## Origins & Attribution

The `a14y` project is the independent implementation of the **Agent Readability Specification** created at Vercel and released here:

* [The Agent Readability Spec](https://vercel.com/kb/guide/agent-readability-spec)
* [Making Documentation Readable by AI Agents](https://vercel.com/kb/guide/make-your-documentation-readable-by-ai-agents)

We are grateful to the Vercel team for sharing this knowledge and for their commitment to an open, agent-readable web.

## License

Apache-2.0 © Timothy Jordan
