# Product Requirements Document — agentready

| Metadata | Value |
| :--- | :--- |
| **Document version** | 2.0 |
| **Status** | Active |
| **Owner** | Timothy Jordan |
| **Initial scorecard** | v0.2.0 |

## 1. Summary

**agentready** is a tool suite that audits documentation websites for *agent readability* — how cleanly an AI agent (LLM context window or RAG ingester) can consume the site's content. It ships in two interchangeable forms backed by a single shared engine:

1. A **Chrome extension** for ad-hoc audits from inside the browser.
2. A **CLI** for local development, scripting, and CI use.

Both call the same `validate()` function in `@agentready/core`, so a given URL produces the **same score** regardless of which target ran the audit.

## 2. Problem

Documentation is historically built for human eyeballs — sticky headers, JavaScript-rendered content, no machine-readable mirrors. AI agents either hallucinate or fail when they can't ingest a page cleanly. There is no standard way for a maintainer to verify that their site exposes the raw, semantic surface modern coding agents need.

## 3. Personas

- **Library maintainer** — wants their docs to be "agent-ready" before each release; needs an at-a-glance score plus actionable failures.
- **DevOps engineer** — wants to gate pull requests on the score; needs an exit-code-driven CLI.
- **Technical writer** — wants to spot-check a page they just edited from inside the browser; needs the extension popup.

## 4. Targets

| Target | Use case | Distribution |
| :--- | :--- | :--- |
| Chrome extension (`@agentready/extension`) | Browser-based ad-hoc audits, single page or whole site | Loaded unpacked from `packages/apps/extension/dist`; Chrome Web Store later |
| CLI (`agentready`) | Local pre-commit, CI gating, JSON pipelines | Published to npm |
| Docs site (`@agentready/docs`) | Public reference for every scorecard version — detection rules, implementation notes, pass/fail examples | Astro + GitHub Pages at https://timothyjordan.github.io/agentready/ |

## 5. Scorecard

The scoring rules live in **versioned scorecards**, separate from the version of the apps. A scorecard is a frozen manifest pinning a stable check id (e.g. `html.canonical-link`) to a specific check implementation version (e.g. `1.0.0`). New scorecards are released as new files (`v0_3.ts`, ...); existing scorecards are never edited.

This means a scorecard release can:

- **Add** a new check (introduce a new id in the manifest)
- **Remove** a check (omit an existing id)
- **Update** a check's behavior (pin the existing id to a new implementation version)

…all without breaking historical comparability. Users can re-run an old scorecard against a fresh audit at any time, so trend data stays consistent across changes to the rules.

### Score formula

```
score = round(passed / applicable * 100)
```

Where `applicable = total - na`. Only `pass` counts toward the numerator. `fail`, `warn`, and `error` are reported but treated identically as "not passed" for scoring. `na` (not applicable, e.g. the API schema check on a non-API page) is excluded from both halves.

### v0.2.0 — initial scorecard

v0.2.0 contains 14 site-level checks and 24 page-level checks (38 total) covering:

- **Discoverability:** llms.txt / llms-full.txt presence, content type, link format; robots.txt presence and AI bot allowance; sitemap.xml validity and lastmod; sitemap.md structure; AGENTS.md (or `.cursorrules`, `CLAUDE.md`, etc.) presence and minimum sections.
- **HTTP basics:** 200 status, ≤1 redirect hop, `text/html; charset=utf-8`, no `noindex`/`noai`/`noimageai` in `x-robots-tag`.
- **HTML metadata:** `<link rel="canonical">`, `<meta name="description">` ≥50 chars, `og:title`, `og:description`, `<html lang>`.
- **Structured data:** parseable JSON-LD, `dateModified`, `BreadcrumbList`.
- **Content structure:** ≥3 headings, text-to-HTML ratio >15%, glossary link.
- **Markdown mirrors:** `<page>.md` / `<page>.mdx` mirror, `<link rel="alternate" type="text/markdown">`, frontmatter (`title`, `description`, `doc_version`, `last_updated`), canonical `Link` header on the mirror, `Accept: text/markdown` content negotiation, `## Sitemap` heading inside the mirror.
- **Code & API:** `language-*` class on every `<pre><code>` block; API pages link to `openapi.json` / `swagger.json` / `swagger.yaml` / `schema.json`.
- **Discovery:** the page is announced by `sitemap.xml`, `llms.txt`, or `sitemap.md` (orphan detection — only meaningful in site mode).

The full list and pinning is in `packages/core/src/scorecard/v0_2.ts`. Human-facing documentation — one page per stable check id with detection mechanics, implementation notes, and references — lives at https://timothyjordan.github.io/agentready/scorecards/0.2.0/ and is sourced from the markdown files under `packages/apps/docs/src/content/checks/`. The docs build is gated on an integrity check that fails loudly if any shipped scorecard references a check id without a matching content file.

## 6. Core engine requirements

The shared engine in `@agentready/core` exports a single `validate()` entrypoint and is responsible for everything below.

### CR-1 — Two modes
- **Page mode**: audit a single URL. Site-level checks still run against the URL's origin so the discoverability story is reflected; the orphan check returns `na` because no site-wide index is available.
- **Site mode**: crawl the entire site and audit every discovered page.

### CR-2 — Discovery
In site mode, seed URLs are collected in parallel from `sitemap.xml` (sitemap-index aware), `llms.txt`, `llms-full.txt`, and `sitemap.md`. The crawler then expands by following same-origin `<a href>` links from each fetched HTML page until `maxPages` is reached.

### CR-3 — Parallelism
The crawler fetches up to `concurrency` pages at a time through a hand-rolled work queue with an optional politeness delay between starts. Site-level checks fan out in parallel, and so do per-page checks within a single page. The runner streams `DiscoveredPage` records as soon as they finish so reports can update live.

### CR-4 — Determinism
Two runs of the same URL against the same scorecard MUST produce a byte-identical `SiteRun` (excluding wallclock timestamps). This is enforced by the parity contract test in `packages/core/test/parity.test.ts`.

### CR-5 — Environment portability
The engine depends only on `globalThis.fetch`, `cheerio`, `fast-xml-parser`, `robots-parser`, and `gray-matter`. It runs unchanged in Node 18+ and inside an MV3 service worker. Core ships dual builds (`dist/cjs` and `dist/esm`) so the CLI can `require()` it and Vite can bundle the ESM entry into the extension.

### CR-6 — Versioned scorecards
`getScorecard(version)` resolves a manifest into runnable checks. It throws a loud error if any pinned id or implementation version is missing from the registry — frozen scorecards can never silently drift. `listScorecards()` enumerates every version.

## 7. CLI requirements

### CLI-1 — Commands
```
agentready check <url> [options]
agentready scorecards [options]
```

### CLI-2 — `check` flags
- `--mode <page|site>` — default `page`
- `--scorecard <version>` — default latest
- `--max-pages <n>` — default 500
- `--concurrency <n>` — default 8
- `--polite-delay <ms>` — default 250
- `--output <text|json>` — default `text`
- `--fail-under <score>` — exit 1 if final score is below threshold
- `--verbose` — stream progress events to stderr

### CLI-3 — Output
- `text` mode prints the score, scorecard metadata, grouped check results, and a per-page roll-up table when in site mode.
- `json` mode emits the full `SiteRun` shape on stdout — the same shape the extension stores in `chrome.storage.local`. This is the documented programmatic surface for downstream tools (jq, dashboards, custom CI).

### CLI-4 — Exit codes
- `0` — audit completed (and met `--fail-under` if set)
- `1` — audit completed but score below threshold, or audit errored
- `2` — invalid arguments

## 8. Chrome extension requirements

### EXT-1 — Manifest
MV3 service worker, `host_permissions: ["<all_urls>"]`, `permissions: ["storage", "activeTab"]`, `action.default_popup` → popup, `options_page` → settings.

### EXT-2 — Popup
- Shows the active tab URL.
- Scorecard dropdown (defaults to latest, lists every shipped version so users can pin trend comparisons).
- Two buttons: **Check this page** and **Scan whole site**.
- Live progress while the audit runs (current site check, per-page progress).
- Final score badge with a link to the full report tab.

### EXT-3 — Background runner
The popup connects via `chrome.runtime.connect({ name: 'agentready-run' })` and posts a `RunRequest`. The service worker runs `validate()` and streams `RunStreamMessage` events back over the same port. Only one audit may be in flight at once. Completed runs are persisted to `chrome.storage.local` (cap 20).

### EXT-4 — Results page
Full audit report in a tab: site-check breakdown, per-page checks (collapsible when there are multiple pages), JSON export download, and a clickable history table that loads any previous run from storage.

### EXT-5 — Options page
Persistent crawl settings: max pages, concurrency, polite delay.

## 9. Non-functional requirements

- **Politeness:** the crawler defaults to ≥250 ms between request starts and limits concurrency to 8.
- **Score parity:** the CLI and the extension MUST produce identical scores for the same URL + scorecard version. Enforced by `parity.test.ts`.
- **Portability:** the CLI runs on macOS, Linux, and Windows; the extension runs on Chromium-based browsers with MV3 support.
- **Test coverage:** every check has at least one passing/failing fixture in `packages/core/test`.

## 10. Repository layout

```
packages/
  core/                  Shared engine (@agentready/core)
    src/scorecard/       Scorecard manifests and registry
    src/checks/site/     Site-level checks
    src/checks/page/     Page-level checks
    src/crawler/         Discovery + parallel queue
    src/runner/          validate(), runPage(), scoring orchestration
    src/fetch/           HttpClient abstraction
    test/                Vitest unit + parity tests
  apps/
    cli/                 Node CLI (`agentready`)
    extension/           Chrome MV3 extension (@agentready/extension)
npm-placeholders/        Reserved npm package names
```

## 11. Roadmap

### v0.2 (current release)
Core engine + CLI + extension shipping the v0.2.0 scorecard.

### v0.3 (next)
- Publish the CLI to npm and the extension to the Chrome Web Store.
- Add more checks based on real-world audit feedback (publish as scorecard v0.3.0).
- Per-page caching across runs in the extension for trend visualization.

### Future
- Linting hints / "Quick Fix" snippets in the extension results page.
- A separate `@agentready/scorecards` package so third parties can publish custom scorecards.
