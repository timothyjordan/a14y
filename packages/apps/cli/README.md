# a14y

Agent readability scorer for documentation sites — `a14y` is shorthand for *agentreadability*.

```bash
npx a14y check https://example.com
```

Also installable as `npx agentready` or `npx agentreadability` — all three names run the same CLI.

## Usage

```bash
a14y check <url>                       # audit a single page
a14y check <url> --mode site           # crawl the whole site
a14y check <url> --output json         # machine-readable scorecard
a14y check <url> --output agent-prompt # markdown fix-list for a coding agent
a14y scorecards                        # list available scorecard versions
```

See `a14y check --help` for the full flag list.

## Docs

Full per-check documentation, scorecard versions, and the underlying spec live at **https://timothyjordan.github.io/a14y/**.

## Source

**https://github.com/timothyjordan/a14y** · Apache-2.0
