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

### `a14y help skills`

```text
Usage: a14y skills [options] [action]

Install or update the a14y agent skill for your coding agents (idempotent)

Arguments:
  action                 optional "update" keyword; install and update are the
                         same idempotent operation

Options:
  --global               install into your home directory (default)
  --local                install into the current project instead of the home
                         directory
  --project              alias for --local
  --target <dir>         write the skill to <dir>/a14y/SKILL.md, bypassing
                         agent auto-detection
  --agent <name>         restrict to a specific agent (repeatable) (default:
                         [])
  --check                report what would change without writing (exits 1 on
                         drift)
  --dry-run              alias for --check
  --force                overwrite a user-modified target or write through a
                         symlink
  -o, --output <format>  text or json (default: "text")
  -h, --help             display help for command
```

## License

Apache-2.0 © Timothy Jordan
