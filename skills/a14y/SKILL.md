---
name: a14y
description: Use when the user wants to audit a website for agent readability, see how well AI agents can discover/parse/comprehend a site, run the a14y CLI, evaluate llms.txt/AGENTS.md/sitemap quality, or improve a project's a14y score. Detects a running local dev server first, falls back to the live URL, runs the audit with `--output agent-prompt`, then presents an itemized plan the user accepts or skips per fix before any change is made, and tracks score history in AGENTS.md.
license: Apache-2.0
compatibility: Requires Node.js 18+ for `npx`, network access to reach the target URL, and shell access. Works with any coding agent that supports the agentskills.io spec (Claude Code, Codex, Cursor, OpenCode, etc.).
metadata:
  version: "0.2.0"
  homepage: https://a14y.dev
  source: https://github.com/timothyjordan/a14y
  spec: https://agentskills.io/specification
allowed-tools: Bash(npx:*) Bash(curl:*) Bash(node:*) Read Edit Write
---

# a14y — Agent readability audit

Audit a website with the open-source [a14y](https://a14y.dev) scorecard, then propose a prioritized fix plan and track score improvements over time.

a14y measures how well an **AI agent** can discover, fetch, parse, and comprehend a site — `llms.txt`, `AGENTS.md`, sitemaps, response codes, semantic markup, code-block language tags, and so on. It is **not** WCAG/disability accessibility; if the user asks about screen-reader support or color contrast, this is the wrong skill.

## When to use

Use this skill when the user says any of:

- "Run a14y on …", "score this site for AI", "is my site agent-ready?"
- "Check our `llms.txt` / `AGENTS.md` / `sitemap`"
- "How readable is this site for coding agents?"
- "Improve our a14y score" / "fix the failing checks"
- "Audit my docs for LLM consumption"

Don't use this skill for:

- WCAG, ARIA, contrast, screen-reader, or other human-disability accessibility work — those need a different tool. (a14y is named for *agent* readability; the homophone is intentional but the scope is different.)
- Anything unrelated to a website's machine-discoverability or agent ergonomics.

## Workflow

Follow these steps in order. Do not skip the URL-detection step — running against the wrong target is the most common way this skill produces useless output.

### 1. Determine the target URL

Two candidates, in this priority order. Present **both** to the user and ask which to audit (don't pick silently — local often has stale fixtures, live often has stale deploys, and only the user knows which is "real" right now).

**a. Look for a running local dev server.** The agent should:

1. Read the project's `package.json` (or `package.json` files in any obvious app directory like `apps/*`, `packages/apps/*`, `web/`, `site/`). Look at `scripts.dev`, `scripts.start`, and any framework hint:
   - `astro` → port `4321`
   - `next`, `react-scripts`, `remix` → port `3000`
   - `vite` → port `5173`
   - `nuxt` → port `3000`
   - `sveltekit` → port `5173`
   - `eleventy` → port `8080`
   - `python -m http.server` / `flask` / `django` → port `8000` or `5000`
2. Probe the most likely ports. A 1-second probe is enough:
   ```bash
   for port in 4321 3000 5173 8080 8000 5000; do
     curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
       --max-time 1 "http://localhost:$port/" || true
   done
   ```
3. Treat any `2xx`/`3xx` with `text/html` as a candidate. If multiple respond, pick the one matching the framework hint from `package.json`.

**b. Look for the live URL.** Search in this order:

1. `package.json` `homepage` field (root and app sub-packages).
2. Astro `astro.config.{js,mjs,ts}` `site:` value.
3. `vercel.json` (`alias`), `netlify.toml` (`[build] publish` is *not* the URL — look at `[context.production.environment]` or the deploy comment), `wrangler.toml` (`route`), `firebase.json`.
4. `README.md` for the first https URL that isn't a badge target.
5. Git remote: `git config --get remote.origin.url` → if it's a GitHub repo, try `https://<owner>.github.io/<repo>/` only as a last resort.
6. Environment variables in `.env*`: `SITE_URL`, `PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `VERCEL_URL`.

If neither candidate exists, ask the user for a URL.

### 2. Read prior configuration

Before asking the user anything, look in this order for a previously-saved `## a14y configuration` section (see step 6 for the format):

1. `AGENTS.md` in the project root.
2. `a14y.md` in the project root (alternate location chosen by users who don't want to modify AGENTS.md).
3. `.well-known/agents.md`, `docs/AGENTS.md`, `CLAUDE.md`, `.cursor/rules` — only as fallbacks for read; do not write to these.

If found, use the saved Target URL, Scorecard, and Mode as defaults; only re-prompt the user if they say "reconfigure" or "use a different URL".

### 3. Pick a scorecard

The default is the latest version. To list shipped versions:

```bash
npx -y a14y scorecards --output json
```

Pin a specific version with `--scorecard <version>` only if the user asks for trend stability across prior runs (e.g. comparing against a stored score that used an earlier scorecard). Otherwise let it default.

### 4. Run the audit

```bash
npx -y a14y check <URL> \
  --mode site \
  --output agent-prompt \
  --max-pages 200
```

- Use `--mode page` for a single-page audit (faster, narrower).
- Default `--max-pages` is `500` — drop it to `200` for faster iteration.
- Add `--scorecard <version>` only if the user asked to pin it.
- Capture stdout — that's the markdown prompt you'll digest in the next step.

To get the numeric score for tracking, run the same command again with `--output json` and read `result.score`:

```bash
npx -y a14y check <URL> --mode site --output json | node -e \
  'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.score)})'
```

(Or parse the score from the agent-prompt output's "Snapshot" header — both work.)

### 5. Propose an itemized plan and wait

**This step is a hard gate.** No file edits, no PRs, no commits, no `Edit`/`Write` against the project until the user approves the plan. Even when the user's original message says "fix it" or "run a14y and apply the fixes," treat the audit run as one turn and the implementation as a *separate* turn gated on plan approval. Auto / yolo / accept-all modes do not exempt this skill — the user is opting into autonomous *audit*, not autonomous edits to their site.

The `--output agent-prompt` markdown contains:

- A "Snapshot" block with the score, scorecard version, mode, and counts.
- A "Failing checks" list, sorted by impact (most-affected pages first).
- For each check: ID, name, group, sample message, docs URL, affected URLs.
- Re-run instructions.

Read the entire output, then build an **itemized checklist** — one row per concrete fix, grouped under file/area headings. The unit of approval is the *row*, not the heading: the user must be able to uncheck individual items without rejecting the whole plan.

Each row uses this shape:

```markdown
- [x] **<one-line action>.** Resolves `<check-id>` (<N pages affected>). <One-line rationale or design note.>
```

- Default to `[x]` (proposed) for most fixes.
- Default to `[ ]` (skipped, but still listed) for items in the **Common skips** list below — users routinely decline these and we shouldn't surface them as silently-accepted.
- Never bundle multiple fixes into one row. "Improve heading structure" is not a row; "Add an `<h1>` to `src/pages/index.astro`" is.
- Lead with the highest-impact files first.

Then route the plan via the host agent's plan-approval mechanism, and end the message with the prompt **"Edit the checklist (uncheck anything you want me to skip) and reply 'go'."** Wait for that reply before any edit.

- **Claude Code:** call `ExitPlanMode` with the checklist as the plan content.
- **Codex / OpenCode:** wrap the checklist in `<plan>…</plan>`.
- **Cursor / generic:** present the checklist inline and explicitly ask the "reply 'go'" prompt above.

#### Example checklist

```markdown
### Proposed fixes — uncheck any you want me to skip, then reply "go"

#### `src/layouts/BaseLayout.astro`
- [x] **Add a glossary link to the footer.** Resolves `agents-md.glossary-link` (4 pages affected). Must visually match existing footer links — see "Match the site's design" below.
- [x] **Wrap the page body in a `<main>` landmark.** Resolves `html.landmarks` (12 pages).

#### `public/AGENTS.md`
- [x] **Add an "## a14y configuration" section.** Resolves `agents-md.has-min-sections` (site-level).

#### `src/pages/scorecards/[version].astro`
- [ ] **Add ≥3 `<h2>`s to every scorecard page.** Resolves `html.heading-depth` (8 pages). *Skipped by default — many sites prefer a single-section landing.*

Edit the checklist (uncheck anything you want me to skip) and reply "go".
```

#### Common skips (default to `[ ]`)

These are fixes users frequently decline. Still list them — the user might want them — but pre-uncheck so the default state respects the most common preference:

- Adding ≥3 headings (`<h2>`/`<h3>`) to every page. Many sites are intentionally single-section.
- Enabling Markdown content negotiation (`Accept: text/markdown` → `.md` mirror). Often blocked by hosting platform constraints.
- Adding `lang` attributes to embedded code snippets.
- Restructuring the primary nav.
- Adding long-form prose to `AGENTS.md` beyond the configuration block — the user may have an authored version they don't want overwritten.

If the same item shows up across several runs and the user keeps unchecking it, stop proposing it (move it to a "Skipped previously, omitted by default" footer at the bottom of the checklist).

### 5b. Match the site's design

For every approved row in the checklist that produces **user-facing** content — footer links, banners, new sections, glossary pages, rendered AGENTS.md surfaces, headings inside existing templates — the change must visually match what is already on the site. Invisible files are exempt: `llms.txt`, `robots.txt`, `sitemap.xml`, and any `AGENTS.md` that isn't rendered to a page can use the skill's default formatting.

Before you touch a user-facing template, do a 2-minute design survey:

1. **Find the layout.** Read the project's main layout/component file:
   - Astro: `src/layouts/*.astro` (often `BaseLayout.astro`).
   - Next: `app/layout.tsx` or `pages/_app.tsx`.
   - SvelteKit: `src/routes/+layout.svelte`.
   - Eleventy: `_includes/base.njk` (or similar).
   - Plain HTML / static: a representative page.
2. **Find the styles.** Read the stylesheet entry and any token files:
   - `src/styles/global.css`, `src/styles/tokens.css`.
   - `tailwind.config.{js,ts}` and any `theme.extend` block.
   - CSS-in-JS config or design-token JSON.
3. **Reuse what's there.** Copy the markup of an existing element of the same kind (e.g. an existing footer link), change only the `href`/text/icon. Use the same classes, the same component, the same tokens. Do **not**:
   - introduce new colours, font-sizes, or spacing values;
   - inline `style="…"`;
   - pull in a new design system or icon set;
   - "improve" the surrounding markup while you're there.

#### Worked example: glossary footer link

If the existing footer renders other links like:

```astro
<a href="/spec/" class="footer-link">Spec</a>
```

then add the glossary link the same way:

```astro
<a href="/glossary/" class="footer-link">Glossary</a>
```

Not a new `<div>`, not a new class, not an inline style.

#### Report back with the design context

When you finish implementing an approved row, your status report must name *where* the new element appears and *which existing class/component* it reuses. One line is enough:

> Added `<a class="footer-link" href="/glossary/">Glossary</a>` next to the existing `Spec` link in `src/layouts/BaseLayout.astro:42`.

That lets the user spot a mismatch before merging without having to diff the rendered site.

### Red flags — stop and re-plan

If you catch yourself doing any of these, stop and back up:

- About to call `Edit` or `Write` on a project file before the user replied "go" → stop. Present the checklist instead.
- About to add a colour, font-size, or className that doesn't already exist in the project → stop. Re-read the layout and styles files; reuse what's there.
- About to bundle multiple fixes into one checklist row ("Improve heading structure") → stop. Split into one row per concrete change.
- The user replied "fix everything" / "do them all" → that approves the whole checklist as-is; still implement only the `[x]` rows you presented, in order, one row per commit if possible. Don't go beyond the approved list.
- The user unchecked an item and said "go" → that item is dead for this turn. Don't argue, don't bundle it back in under a different name.

### 6. Save configuration and score history

After the user approves the plan, **and before you start implementing**, ask once:

> "I'd like to save the a14y configuration (target URL, scorecard, recent scores) so re-runs are one command. Save it to **AGENTS.md** (recommended — having a 'configuration' section also improves your a14y score) or to a separate **a14y.md** file?"

Whichever the user picks, upsert this exact section (replace any existing one):

```markdown
## a14y configuration

- Target URL: https://example.com
- Scorecard: 0.2.0
- Mode: site
- Last runs:
  - 2026-05-05 — 87 (scorecard 0.2.0)
  - 2026-04-30 — 82 (scorecard 0.2.0)
  - 2026-04-15 — 78 (scorecard 0.2.0)
```

Rules for the `Last runs:` list:

- Newest first.
- Keep the most recent **5** entries; drop older ones.
- Each line: `YYYY-MM-DD — <score> (scorecard <version>)`.

If the user declines persistence, skip this step — but do still **report the score in the conversation** so the user can see the delta on the next run.

### 7. After fixes are implemented, re-run and report the delta

**This step is mandatory and the loop is not closed until you complete it.** Do not end the turn after merging a PR or shipping fixes — the user expects to see the new score. If the deployment is asynchronous (GitHub Pages, Vercel preview promotion, Netlify, Cloudflare Pages), wait for it before re-running:

```bash
# Poll the production URL until the change you shipped is live, then break.
# Pick a check that's specific to the fix (e.g. an AGENTS.md you just added,
# a new <h1>, an updated llms.txt). Generic 200-OK polling is not enough —
# CDNs serve cached HTML.
until curl -fsS https://example.com/AGENTS.md > /dev/null; do sleep 5; done
```

Once live, **immediately** in the same turn:

1. Re-run `npx -y a14y check <URL> --mode site --output agent-prompt` against the production URL (and against `--output json` for the score).
2. Compute the delta vs. the prior score from the saved configuration (step 6).
3. Print a summary block to the user that names what resolved and what's still failing. Keep it clinical:

   ```
   Score: 87 → 92 (+5)
   Resolved: agents-md.has-min-sections, llms-txt.is-markdown
   Still failing: html.lang-attr (3 pages), code.language-tags (12 pages)
   ```

   **If the delta is positive** (`new > old`), follow that block with a celebratory share-ready summary the user can copy verbatim to X, LinkedIn, or Bluesky. Use this exact format, substituting the new score, the prior score, the audited hostname, the scorecard version, and the passed/applicable counts:

   ```
   <hostname> scored <score>/100 for Agent Readability — up from <old> after today's fixes.

   Scorecard v<version> · <passed>/<applicable> checks passed

   Audit your own site at https://a14y.dev?utm_source=skill&utm_medium=share
   ```

   Frame it for the user with: *"Nice lift. Here's a share-ready summary if you want to post about it:"* then the block. Do **not** print the celebratory block when the delta is zero or negative.

   The `text` output of `npx -y a14y check <URL>` ends with a line that starts `Embed badge: ` and carries a fully-formed URL the CLI constructed from this run — for example:

   ```
   Embed badge: https://a14y.dev/badge/?s=92&v=0.2.0&a=35&t=38&p=32&f=3&w=0&e=0&n=3&d=2026-05-05&m=site&u=https%3A%2F%2Fexample.com
   ```

   **Do not reconstruct the URL.** Find that exact line in the CLI's stdout and copy the URL character-for-character into your reply. The URL contract (param keys, encoding, ordering) is the CLI's concern, not yours.

   Frame it for the user as: *"And if you want to publish the score on your site, here's an embeddable HTML badge:"* — then paste the line. Surface this regardless of delta direction; the badge is useful even when the score didn't move.
4. Append the new run to the `Last runs:` list in `AGENTS.md` / `a14y.md` (newest first; keep 5).
5. If new failures appeared that weren't in the prior run, flag them as a regression and ask the user before going around again.

Only after all five sub-steps land is the audit cycle complete. If a deploy poller is still running when you would otherwise stop, keep waiting — don't hand control back with the audit unfinished.

## Quick reference

| Task | Command |
|---|---|
| Audit a single page | `npx -y a14y check <url>` |
| Audit a whole site | `npx -y a14y check <url> --mode site` |
| Get the agent fix-prompt | `npx -y a14y check <url> --output agent-prompt` |
| Get JSON for scripting | `npx -y a14y check <url> --output json` |
| List shipped scorecards | `npx -y a14y scorecards` |
| Pin a scorecard version | `npx -y a14y check <url> --scorecard 0.2.0` |
| CI gate (fail under 80) | `npx -y a14y check <url> --fail-under 80` |
| Faster site crawl | `npx -y a14y check <url> --mode site --max-pages 100 --concurrency 12` |
| Disable telemetry | `npx -y a14y --no-telemetry check <url>` |
| Get an embed badge URL | (printed at the bottom of the `text` output of any `check`) |

## Common mistakes

- **Auditing a localhost URL behind auth.** a14y will get the login page and report it as the whole site. Either bypass auth for the dev environment or audit the live URL.
- **Confusing agent-readability with WCAG.** `agents-md.has-min-sections` is not about screen readers. If the user wants WCAG, redirect them.
- **Running `--mode site` on a huge site without `--max-pages`.** The default cap is 500 pages, but it can still take minutes. Lower it for iteration.
- **Re-running with a different `--scorecard`** and comparing scores. Scorecard versions are not score-comparable. Always pin the same version when measuring deltas.
- **Modifying `AGENTS.md` without showing the diff first.** AGENTS.md is part of the audit surface — surprise edits can lower the score. Show the diff and confirm before writing.
- **Trusting a single-page score as a site score.** `--mode page` only evaluates one URL plus site-level checks. For a representative score, use `--mode site`.
- **Stopping after the PR merges.** The loop is not "audit → plan → fix → PR" — it is "audit → plan → fix → PR → **wait for deploy → re-audit → report delta → update history**". Sites with async CDN deploys (GitHub Pages, Vercel, Netlify, Cloudflare Pages) need a poll-then-rerun before you hand control back; ending the turn at "merged" leaves the user without the score they came for.
- **Implementing before the user approves the checklist.** "Run a14y and fix it" is two turns, not one. Run the audit, present the itemized checklist, wait for "go". Auto / yolo / accept-all modes don't override this — the user opted into autonomous *audit*, not autonomous edits to their site.
- **Treating the checklist as all-or-nothing.** Each row is independently approvable. If the user unchecks "add `<h1>` to every page," do not argue and do not bundle it back in under a different name. If they reply "go" with edits, only the still-`[x]` rows are approved.
- **Adding visible content without matching the site's design.** Footer links, banners, headings, glossary entries must reuse the project's existing layout components, classes, and design tokens. Read `BaseLayout.astro` (or the framework equivalent) and the stylesheet entry *before* you write the change. If you can't find the right token, ask before inventing.

## Integration with other skills / tools

- This skill **proposes** the plan; the *implementation* of fixes is the host agent's normal job (editing files, running tests, opening PRs).
- The agent-prompt output is also available as a download in the a14y Chrome extension. If the user already has it, they can paste it in as user content and you can skip step 4.
- For CI, point teammates at `--fail-under` rather than asking the agent to enforce a threshold by hand.

## Reference

- Spec, scorecard, and per-check docs: <https://a14y.dev>
- Source: <https://github.com/timothyjordan/a14y>
- Skill discovery (this file via the live site): `https://a14y.dev/.well-known/agent-skills/a14y/SKILL.md`
- agentskills.io spec: <https://agentskills.io/specification>
