---
name: a14y
description: Use when the user wants to audit a website for agent readability, see how well AI agents can discover/parse/comprehend a site, run the a14y CLI, evaluate llms.txt/AGENTS.md/sitemap quality, or improve a project's a14y score. Detects a running local dev server first, falls back to the live URL, runs the audit with `--output agent-prompt`, and proposes a fix plan tracked against prior runs in AGENTS.md.
license: Apache-2.0
compatibility: Requires Node.js 18+ for `npx`, network access to reach the target URL, and shell access. Works with any coding agent that supports the agentskills.io spec (Claude Code, Codex, Cursor, OpenCode, etc.).
metadata:
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

### 5. Read the agent-prompt and propose a plan

The `--output agent-prompt` markdown contains:

- A "Snapshot" block with the score, scorecard version, mode, and counts.
- A "Failing checks" list, sorted by impact (most-affected pages first).
- For each check: ID, name, group, sample message, docs URL, affected URLs.
- Re-run instructions.

Read the entire output. Then **propose a plan** to the user via the host agent's plan-approval mechanism:

- **Claude Code:** call `ExitPlanMode` after writing the plan.
- **Codex / OpenCode:** wrap the plan in `<plan>…</plan>` and ask "approve to proceed?".
- **Cursor / generic:** present a numbered list and explicitly ask "Should I implement these fixes?" — do not start editing until the user replies yes.

Group fixes by *file or area*, not by check ID — many checks resolve with the same change (e.g. adding a top-level `<h1>` to every page, or adding `class="language-*"` to every `<pre>`). Lead with the highest-impact changes.

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
3. Print a summary block to the user that names what resolved and what's still failing:
   ```
   Score: 87 → 92 (+5)
   Resolved: agents-md.has-min-sections, llms-txt.is-markdown
   Still failing: html.lang-attr (3 pages), code.language-tags (12 pages)
   ```
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

## Common mistakes

- **Auditing a localhost URL behind auth.** a14y will get the login page and report it as the whole site. Either bypass auth for the dev environment or audit the live URL.
- **Confusing agent-readability with WCAG.** `agents-md.has-min-sections` is not about screen readers. If the user wants WCAG, redirect them.
- **Running `--mode site` on a huge site without `--max-pages`.** The default cap is 500 pages, but it can still take minutes. Lower it for iteration.
- **Re-running with a different `--scorecard`** and comparing scores. Scorecard versions are not score-comparable. Always pin the same version when measuring deltas.
- **Modifying `AGENTS.md` without showing the diff first.** AGENTS.md is part of the audit surface — surprise edits can lower the score. Show the diff and confirm before writing.
- **Trusting a single-page score as a site score.** `--mode page` only evaluates one URL plus site-level checks. For a representative score, use `--mode site`.
- **Stopping after the PR merges.** The loop is not "audit → plan → fix → PR" — it is "audit → plan → fix → PR → **wait for deploy → re-audit → report delta → update history**". Sites with async CDN deploys (GitHub Pages, Vercel, Netlify, Cloudflare Pages) need a poll-then-rerun before you hand control back; ending the turn at "merged" leaves the user without the score they came for.

## Integration with other skills / tools

- This skill **proposes** the plan; the *implementation* of fixes is the host agent's normal job (editing files, running tests, opening PRs).
- The agent-prompt output is also available as a download in the a14y Chrome extension. If the user already has it, they can paste it in as user content and you can skip step 4.
- For CI, point teammates at `--fail-under` rather than asking the agent to enforce a threshold by hand.

## Reference

- Spec, scorecard, and per-check docs: <https://a14y.dev>
- Source: <https://github.com/timothyjordan/a14y>
- Skill discovery (this file via the live site): `https://a14y.dev/.well-known/agent-skills/a14y/SKILL.md`
- agentskills.io spec: <https://agentskills.io/specification>
