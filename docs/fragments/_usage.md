## Usage

```bash
a14y <url>                           # audit a single page
a14y <url> --mode site               # crawl the whole site
a14y <url> --output json             # machine-readable scorecard
a14y <url> --output agent-prompt     # Markdown fix-list for a coding agent
a14y scorecards                      # list available scorecard versions
```

`check` is the default command: `a14y <url>` is exactly the same as `a14y check <url>`. For full flag documentation run `a14y --help` (summary) or `a14y help check` (detail).
