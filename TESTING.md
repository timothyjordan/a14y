# Testing agentready

## Testing the CLI

**Build first:**
```
npm run build
```

**Try it locally without installing:**
```
node packages/apps/cli/dist/index.js --help
node packages/apps/cli/dist/index.js scorecards
node packages/apps/cli/dist/index.js scorecards --output json
```

**Audit a single page:**
```
node packages/apps/cli/dist/index.js check https://docs.anthropic.com/en/docs/claude-code/overview
```

**Audit a whole site (with verbose progress on stderr):**
```
node packages/apps/cli/dist/index.js check https://docs.anthropic.com \
  --mode site --max-pages 25 --concurrency 4 --verbose
```

**Get JSON for piping into jq:**
```
node packages/apps/cli/dist/index.js check https://docs.anthropic.com \
  --output json | jq '.summary'
```

**Use it as a CI gate:**
```
node packages/apps/cli/dist/index.js check https://example.com --fail-under 80
echo "exit code: $?"
```

**Pin an older scorecard for trend stability** (only `0.2.0` exists today):
```
node packages/apps/cli/dist/index.js check https://example.com --scorecard 0.2.0
```

**Install it globally as `agentready` from this checkout:**
```
npm link --workspace agentready
agentready check https://example.com
```

**Run the unit tests:**
```
npm test --workspace @agentready/core   # 67 engine tests
npm test --workspace agentready         # 3 CLI smoke tests
```

---

## Testing the Chrome extension

**Build it:**
```
npm run build --workspace @agentready/extension
```
This produces `packages/apps/extension/dist/`.

**Load it in Chrome:**
1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked**
4. Pick the folder `packages/apps/extension/dist`
5. The Agent Readability icon appears in the toolbar (pin it via the puzzle-piece menu for easy access)

**Smoke test the popup:**
1. Navigate to any docs site (e.g. https://docs.anthropic.com)
2. Click the extension icon
3. The popup shows the current URL, a scorecard dropdown (defaults to v0.2.0), and two buttons
4. Click **Check this page** — progress streams live, then a score badge appears
5. Click **Scan whole site** — same flow but it crawls (watch the "Visited N pages" counter)

**View the full report:**
- Click **View full report** in the popup → opens `results.html` in a new tab
- You'll see site checks, per-page checks (collapsible if multiple), a **Download JSON** button, and a clickable **History** table of recent runs (capped at 20, persisted in `chrome.storage.local`)

**Try the options page:**
- Right-click the extension icon → **Options**
- Adjust max pages, concurrency, polite delay → Save

**Verify CLI/extension parity manually:**
1. Run the CLI: `node packages/apps/cli/dist/index.js check https://example.com --output json | jq '.summary.score'`
2. Run the extension popup against the same URL with the same scorecard version
3. Scores should match exactly (this is what `parity.test.ts` enforces in unit tests)

**Iterate during development:**
```
npm run dev --workspace @agentready/extension
```
Vite + crxjs will rebuild on save; click the reload icon in `chrome://extensions` to pick up changes.

**Debug the service worker:**
- On `chrome://extensions`, find Agent Readability and click **Service worker** (the link under "Inspect views")
- DevTools opens against the background script; you'll see `console.log` from `background.ts` and any thrown errors

**Common gotchas:**
- First run on each new domain may prompt for host permission — accept it.
- Some sites set CORS that blocks the `Accept: text/markdown` content-negotiation request; that single check will return `warn` rather than crashing the audit.
- The crawler defaults to 250 ms politeness delay and 8 concurrent fetches — bump them down in Options if you're hitting a rate limit.
