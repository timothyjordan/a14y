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

---

## Testing the docs site

**Build it:**
```
npm run build --workspace @agentready/core
npm run build --workspace @agentready/docs
```

This produces 41 static pages under `packages/apps/docs/dist/` — a landing page, a scorecards index, one overview per shipped scorecard, and one detail page per check (38 of them for v0.2.0).

**Local preview:**
```
npm run dev --workspace @agentready/docs
```
Opens at `http://localhost:4321/agentready/`. The base path matches the GitHub Pages deploy, so links work identically in dev and prod.

**Smoke test the rendered site:**
1. Visit `/agentready/` — landing page should show "v0.2.0" as the latest scorecard
2. Click through to `/agentready/scorecards/0.2.0/` — should list 38 checks grouped by site/page and then by category
3. Open any check detail page (e.g. `/agentready/scorecards/0.2.0/checks/html.canonical-link/`) and verify the frontmatter metadata (impl version, group, scope) matches what `@agentready/core` exports
4. Open the **Scorecard** dropdown in the header — switching versions should change the URL to `/agentready/scorecards/<new>/...` preserving the deep link

**Run the coverage test:**
```
npm test --workspace @agentready/docs
```
This asserts that every stable check id pinned in any shipped scorecard has a corresponding markdown file under `src/content/checks/`. If this test fails, the docs build will also fail — they share the same `assertCoverage()` helper.

**Add a new check to the docs:**
1. Add the check to `@agentready/core` (registry + scorecard manifest)
2. Create `packages/apps/docs/src/content/checks/<stable-id>.md` with the frontmatter schema from `src/content/config.ts` and the standard prose sections (How it decides, How to implement, Pass/Fail, References)
3. `npm test --workspace @agentready/docs` must pass
4. `npm run build --workspace @agentready/docs` must generate a new detail page for the id

**Deployment:**
Pushes to `main` that touch `packages/apps/docs/**`, `packages/core/**`, or `.github/workflows/deploy-docs.yml` trigger the `deploy-docs` workflow. It builds the core package first (the docs build imports its dist), then builds the docs, uploads `packages/apps/docs/dist/` as a Pages artifact, and deploys via `actions/deploy-pages@v4`. The site lives at `https://timothyjordan.github.io/agentready/`.

For the first deploy, the Pages source in the repo settings must be set to **GitHub Actions** (Settings → Pages → Source → GitHub Actions).

**Score ceiling on static hosting (the two accept-fails):**

The docs site dogfoods the agentready scorecard against itself. On GitHub Pages — a fully static host — two checks cannot pass for fundamental hosting reasons:

- **`markdown.content-negotiation`** — requires the server to honour `Accept: text/markdown` and return a different response body. Static hosts can't branch on request headers.
- **`markdown.canonical-header`** — requires setting a per-response `Link: <…>; rel="canonical"` header on the `.md` mirror. Static hosts can't set custom per-file response headers.

Both checks are documented as **wontfix on static hosting**. If we ever migrate the docs site to Vercel / Netlify / Cloudflare Pages, both become fixable in ~10 lines of edge function code each. For now, the realistic ceiling on the scorecard is `(applicable − 2) / applicable` per page, which works out to roughly **95–97%** depending on the number of N/A checks per page.

When running `agentready check https://timothyjordan.github.io/agentready/ --mode site` for verification, expect exactly these two ids in the per-page failures and nothing else. Anything else is a regression.
