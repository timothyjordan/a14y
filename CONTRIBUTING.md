# Contributing to a14y (Agent Readability)

Thanks for your interest in a14y! a14y is an open spec, a versioned
scorecard, and a CLI plus Chrome extension that score how cleanly any
website can be read by AI agents (ChatGPT, Claude, Copilot, Cursor).
This file is the starting point for editing the docs site, updating
the scorecards, adding a check, or adding a new page.

> **Before you get started:** the single most important thing to
> understand is that **once a version of a scorecard is published it
> can never be changed.** Every site pinned to that version must keep
> getting the same score forever. All evolution happens in the mutable
> `draft.ts`; see [Scorecard lifecycle](#scorecard-lifecycle).

## TL;DR

```sh
npm install
npm run build
npm test                          # every workspace
```

- Branch off `main` (`feature/...`, `fix/...`, `refactor/...`,
  `docs/...`, `chore/...`); never commit directly to `main`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) —
  the release pipeline keys off them. See
  [`RELEASING.md`](./RELEASING.md) for scopes.
- **The published scorecard is an immutable contract.** Once a
  scorecard version ships (`packages/core/src/scorecard/v0_*.ts`), it
  is never modified — every consumer pinned to that version must keep
  getting the same score forever. All changes go into the mutable
  `draft.ts`; see [Scorecard lifecycle](#scorecard-lifecycle).
- READMEs in this repo are generated; never hand-edit a `README.md`.
  Edit `docs/templates/` or `docs/fragments/` and run `npm run docs`.

If you're a coding agent (Claude Code, Codex, Cursor, etc.), also read
[`AGENTS.md`](./AGENTS.md) for a machine-readable summary of the
invariants below.

## Contents

- [Pick your path](#pick-your-path)
- [Repo layout](#repo-layout)
- [Editing the docs site (a14y.dev)](#editing-the-docs-site-a14ydev)
- [Scorecard lifecycle](#scorecard-lifecycle)
- [Adding a new check](#adding-a-new-check)
- [Updating an existing check](#updating-an-existing-check)
- [Adding a new page](#adding-a-new-page)
- [Local development](#local-development)
- [Tests](#tests)
- [Visual / design parity](#visual--design-parity)
- [Branching, commits, and PRs](#branching-commits-and-prs)
- [Common pitfalls](#common-pitfalls)
- [Releases](#releases)

## Pick your path

| You want to… | Read |
| --- | --- |
| Add or change a scorecard check | [Adding a new check](#adding-a-new-check) / [Updating an existing check](#updating-an-existing-check) |
| Edit prose on the docs site | [Editing the docs site](#editing-the-docs-site-a14ydev) → "Prose-heavy pages" |
| Change the design or layout of the site | [Editing the docs site](#editing-the-docs-site-a14ydev) → "Design-heavy pages", then [Visual / design parity](#visual--design-parity) |
| Add a brand-new page | [Adding a new page](#adding-a-new-page) |
| Fix a typo in a `README.md` | Don't — edit `docs/templates/` or `docs/fragments/`, run `npm run docs` |
| Test the CLI / extension / site by hand | [`TESTING.md`](./TESTING.md) |
| Cut or ship a release | [`RELEASING.md`](./RELEASING.md) |

## Repo layout

The repo is organized as an npm workspaces monorepo. Most contributions
land in either `packages/apps/docs` (the a14y.dev site) or
`packages/core` (the scorecard registry and check implementations).

```text
a14y/
├── packages/
│   ├── apps/
│   │   ├── docs/         # a14y.dev — Astro site, content collections, mirror integration
│   │   ├── cli/          # `a14y` CLI (npm: a14y)
│   │   └── extension/    # Chrome extension
│   ├── core/             # scorecard registry, check implementations, types
│   ├── telemetry/        # shared opt-in telemetry helpers
│   └── aliases/          # npm-published name aliases for `a14y`
├── scripts/              # build-readmes and other repo-wide tooling
├── AGENTS.md             # machine-readable invariants for coding agents
├── CONTRIBUTING.md       # this file
├── RELEASING.md          # release flow (npm, extension, docs site)
└── TESTING.md            # smoke-test recipes for CLI / extension / site
```

The site, CLI, and extension all consume `@a14y/core` for their checks
and scorecard data, so most "where do I add a check" answers live there.

## Editing the docs site (a14y.dev)

The docs site uses two different authoring directions depending on the
page. Pick the right one before you start editing.

### Prose-heavy pages → markdown is the source

Pages: `/glossary/`, `/privacy/`, `/scorecards/` (intro + tail).

Edit the matching file in `packages/apps/docs/src/content/pages/`:

| URL | Source |
| --- | --- |
| `/glossary/` | `glossary.md` |
| `/privacy/` | `privacy-intro.md` + `privacy-tail.md` (split around the opt-out button) |
| `/scorecards/` | `scorecards-intro.md` + `scorecards-tail.md` (split around the synthesized version list) |

Pure markdown — do not embed `<div>`, `<span>`, etc. Astro renders the
body via `<Content />` in the matching `.astro` shell, and the same
body is emitted to the `.md` mirror at build time.

You can use the following placeholders in any prose-heavy page; they
are substituted in both the rendered HTML and the `.md` mirror:

- `{{LATEST_VERSION}}` — most recent shipped scorecard version (e.g. `0.2.0`).
- `{{TOTAL_CHECKS}}` — total checks pinned by the latest scorecard.
- `{{SITE_CHECK_COUNT}}` / `{{PAGE_CHECK_COUNT}}` — split by scope.
- `{{RELEASED_AT}}` — release date of the latest scorecard.
- `{{LAST_UPDATED}}` — build-time date stamp.

### Design-heavy pages → JSX is the source

Pages: `/` (landing), `/spec/`.

Edit `packages/apps/docs/src/pages/index.astro` or
`src/pages/spec.astro` directly. These pages use bespoke layout
(pillar cards, tool cards, spec-layer cards, the agent CLI demo),
so the `.astro` file is canonical.

The `.md` mirror is generated automatically: the build pipeline reads
the rendered HTML out of `dist/`, runs it through the Turndown-based
converter in `src/lib/html-to-markdown.ts`, and writes a clean
markdown sibling. You should not maintain a parallel `.md` file.

If you add a new design component to one of these pages and want it
to come through cleanly in the mirror, add a Turndown rule in
`html-to-markdown.ts` (and a test in `test/html-to-markdown.test.ts`).
The default rules cover hero text, headings, paragraphs, links,
fenced code, pillar cards, tool cards, and spec-layer cards.

### Check-detail pages → markdown per check

Pages: `/scorecards/<version>/checks/<check-id>/`.

Edit `packages/apps/docs/src/content/checks/<check-id>.md`. Pure
markdown with required frontmatter (see existing entries for the
canonical shape):

```yaml
---
id: agents-md.exists
title: AGENTS.md (or equivalent) is published
group: Discoverability
scope: site            # site | page
why: >
  Short paragraph explaining why this check exists.
---
```

The template at `src/pages/scorecards/[version]/checks/[id].astro`
renders the body via `<Content />`; the mirror integration emits the
same body verbatim to the `.md` sibling.

### Scorecard version pages → synthesized

Pages: `/scorecards/<version>/`, plus the `/scorecards/draft/` alias.

These are not authored by hand — they are generated from the registry
in `@a14y/core`. The build will fail loudly if a scorecard pin lacks a
matching content file (see `src/lib/assert-coverage.ts` and
`test/coverage.test.ts`). To add or remove a check on the rubric, edit
`packages/core/src/scorecard/draft.ts` (see "Scorecard lifecycle"
below) and add a corresponding `src/content/checks/<id>.md`.

## Scorecard lifecycle

> **The contract.** Once a scorecard version is published, it is
> immutable. Every consumer pinned to `0.2.0` — CLIs in CI pipelines,
> extensions, dashboards tracking trend lines — must keep getting the
> exact same score for the exact same input, forever. That guarantee
> is the entire reason scorecard versions exist. Breaking it silently
> invalidates every historical score anyone has ever recorded against
> that version. Treat published manifests as append-only history, not
> as code you can fix.

The scorecard ships as a set of frozen manifests plus one mutable
**draft**.

- **Published manifests** live at `packages/core/src/scorecard/v0_*.ts`
  (e.g. `v0_2.ts`). These are FROZEN: never edited after release so
  historical scores stay reproducible forever. Each one pins every
  stable check id to a single implementation version. If a check's
  behavior needs to change, you ship a *new* implementation version
  (`'1.1.0'`) and pin it in `draft.ts` — the old `'1.0.0'` stays in
  source so the frozen manifest can still resolve it.
- **The draft manifest** lives at `packages/core/src/scorecard/draft.ts`
  and uses a semver pre-release version (e.g. `0.3.0-draft`). It is the
  contribution surface — PRs adding new check ids, bumping pinned
  implementation versions, or removing deprecated checks all land here.
  Consumers can preview it via `a14y check --scorecard draft` or at
  <https://a14y.dev/scorecards/draft/>.
- **Cut day**: the team copies `draft.ts` to a new frozen `v0_N.ts`,
  drops the `-draft` suffix, then reseeds `draft.ts` with the next
  planned version. See [`RELEASING.md`](./RELEASING.md#cutting-a-new-scorecard).

> **Invariant — do not break.** Never edit a `v0_*.ts` file. Never
> mutate an existing `'1.x.x'` entry under `implementations`. These
> two files-of-the-past *are* the immutability contract. All scorecard
> contributions go through `draft.ts` and through a *new*
> `implementations` entry.

### Diff refresh workflow

When a PR changes `packages/core/src/scorecard/draft.ts`, the docs site
needs to surface the resulting diff vs the latest published scorecard
— added / removed / bumped checks with per-change attribution to the
contributor and PR. That listing is rendered from
`packages/core/src/scorecard/draft-changes.json`, which is regenerated
by the **`refresh-draft-diff`** GitHub workflow.

The workflow runs **after** a merge to `main`, not inside the PR. It
recomputes the net diff, reconciles it against the existing
`draft-changes.json` (entries whose check id no longer appears in the
net diff are dropped; that's how conflict resolution works when a
later commit reverts an earlier one), and, if the JSON needs updating,
opens a follow-up PR with the refreshed file. **There is no
auto-merge:** a maintainer reviews and merges the refresh PR like any
other change. Two flows cover every case:

1. **Auto-run on merge to `main`.** A push to `main` that touches
   `draft.ts`, `draft-changes.json`, `scripts/refresh-draft-diff.mjs`,
   or the workflow file triggers `refresh-draft-diff`. Attribution for
   any new entries comes from the PR associated with the merge commit
   (resolved via `gh api repos/{repo}/commits/{sha}/pulls`). The
   refreshed JSON arrives as a PR on the fixed `chore/refresh-draft-diff`
   branch. Repeated runs force-update that branch in place rather than
   stacking new PRs, and the run is a no-op when nothing changed. No
   action needed from you beyond reviewing and merging that follow-up.
2. **Manual catch-up (`workflow_dispatch`).** If the auto-run didn't
   fire (infra failure, a push collision, etc.) or you want to
   re-reconcile against the current state of `main`, trigger it by hand:
   `Actions → Refresh draft diff → Run workflow`. There's no PR context
   on a manual run, so the script falls back to "audit" attribution
   (`pr: 0`, author = the actor who triggered the run). Output is the
   same follow-up PR.

To preview what the workflow would produce without pushing, run
`node scripts/refresh-draft-diff.mjs --local` against your working tree;
it prints the would-be JSON and exits.

### Docs-first for scorecard changes

Any non-trivial rubric change — adding a check, removing a check, or
bumping a pinned implementation version — should ship in **two PRs**:
the **spec PR** first, then the **implementation PR**. This keeps the
impl PR pointed at a fixed target instead of a moving one, lets
reviewers reason about each piece in isolation, and prevents `main`
from ever holding docs that are ahead of or behind the code.

The split, concretely:

1. **Spec PR.** Lands the contract.
   - The check's content page at
     `packages/apps/docs/src/content/checks/<id>.md` (new file, or the
     updated description of what the bumped version means).
   - The pin in `packages/core/src/scorecard/draft.ts` (new entry, or
     the bumped version).
   - **For "updating an existing check" only**, also include a **stub
     `'1.1.0'` implementation** in the check's `implementations` map —
     typically a verbatim copy of the previous version's handler — so
     the new pin resolves and `npm test --workspace @a14y/core` stays
     green. The impl PR replaces this stub.
2. **Implementation PR.** Lands the real `'1.1.0'` handler over the
   stub. No `draft.ts` changes, no doc copy changes — just the
   behavior the spec PR already described.

Both PRs touch `draft.ts`, so the `refresh-draft-diff` workflow will
run on each. The second run rewrites `draft-changes.json` to attribute
the entry against the impl PR — that's expected, not a regression.

For the per-step recipes once you've chosen the right PR, see
[Adding a new check](#adding-a-new-check) and
[Updating an existing check](#updating-an-existing-check).

### Validating a draft scorecard against a published one

`a14y check` accepts `--scorecard` repeatedly so a single scan can be
scored against multiple scorecard versions at once:

```
a14y check https://example.com --scorecard 0.2.0 --scorecard draft
```

The crawler still fetches each page exactly once. For every shared
check id where both scorecards pin the same implementation version, the
handler runs once and the outcome is reused for both summaries. Where
they pin different versions (e.g. a bumped check on the draft), each
version's handler runs against the in-memory page — same fetch, two
handlers. With `--output json`, the result is an array of `SiteRun`
objects, one per scorecard version in the order you listed them.

Use this when you've staged a draft change (new pin, bumped impl,
methodology change) and want to compare its scores against the latest
published scorecard before cutting. Single-scorecard runs are
unaffected — output shape, exit code, and share block all stay
identical to today.

## Adding a new check

> For non-trivial additions, ship this as the impl PR of a
> [docs-first split](#docs-first-for-scorecard-changes) — land the
> spec PR (content page + `draft.ts` pin) first.

1. Implement the check under `packages/core/src/checks/{site,page}/`.
   Use a fresh stable id; add an entry under `implementations` keyed
   by `'1.0.0'`.
2. Wire it into the registry by adding the import to
   `packages/core/src/scorecard/_imports.ts`.
3. Pin it in the **draft** manifest at
   `packages/core/src/scorecard/draft.ts`. Do not edit any frozen
   `v0_*.ts`.
4. Add `packages/apps/docs/src/content/checks/<id>.md` with the
   frontmatter shape above. The `id` field must match the manifest pin.
5. Run the tests under [Tests](#tests).

## Updating an existing check

If a check's behavior should change (better detection, fewer false
positives, etc.):

> For non-trivial bumps, ship this as the impl PR of a
> [docs-first split](#docs-first-for-scorecard-changes) — land the
> spec PR (updated content page + `draft.ts` pin + stub `'1.1.0'`)
> first.

1. In the check's source file under
   `packages/core/src/checks/{site,page}/`, add a new entry to
   `implementations` keyed by a bumped semver (e.g. `'1.1.0'`). Leave
   the old `'1.0.0'` implementation in place — frozen scorecards still
   reference it.
2. In `packages/core/src/scorecard/draft.ts`, update the pin for that
   check id from `'1.0.0'` to `'1.1.0'`. Do not touch any frozen
   `v0_*.ts` file.
3. Update the check's docs at
   `packages/apps/docs/src/content/checks/<id>.md` if the behavior
   description changes.
4. Run the tests under [Tests](#tests).

## Adding a new page

1. Create a route under `packages/apps/docs/src/pages/` (`.astro`).
2. Decide whether the page is prose-heavy or design-heavy and follow
   the matching workflow above.
3. If you want a `.md` mirror at the matching URL, register the page:
   - **Prose-heavy**: add a content collection entry under
     `src/content/pages/` and map its URL in
     `resolvePagesSlug()` inside
     `src/integrations/markdown-mirrors.ts`.
   - **Design-heavy**: add the URL to the `HTML_DERIVED_PAGES` map
     in `src/integrations/markdown-mirrors.ts`.
4. The site emits an `<link rel="alternate" type="text/markdown">`
   pointing at the mirror automatically once the URL is registered.

## Local development

The mirror integration runs as part of `astro build`, so `astro dev`
will serve HTML pages but will not emit `.md` mirrors. To preview both
together:

```sh
npm install
npm run build --workspace @a14y/docs
npm run preview --workspace @a14y/docs
```

`npm run preview` runs a tiny custom static server
(`packages/apps/docs/scripts/preview.mjs`) that serves `dist/` with
the right Content-Type per file extension — including
`text/markdown; charset=utf-8` for `.md` mirrors so UTF-8 glyphs
(`✓`, `✗`, `✔`, `·`) render correctly. Astro's built-in
`astro preview` defaults to `text/markdown` with no charset, which
makes browsers fall back to Latin-1 and mojibake the output; the
custom script avoids that.

For HTML-only iteration, `npm run dev --workspace @a14y/docs` is
faster.

For broader smoke-testing recipes (CLI, Chrome extension, end-to-end
docs site checks), see [`TESTING.md`](./TESTING.md).

## Tests

```sh
npm test --workspace @a14y/core    # registry + check engine
npm test --workspace @a14y/docs    # mirror integration + coverage gate
npm test                           # every workspace + the readme builder
```

Add or update tests with every code change:

- Unit tests live under `packages/<pkg>/test/` (vitest).
- The docs site has dedicated suites for the mirror integration
  (`test/markdown-mirrors.test.ts`), the HTML-to-markdown converter
  (`test/html-to-markdown.test.ts`), the page-substitutions remark
  plugin (`test/page-substitutions.test.ts`), and the coverage gate
  (`test/coverage.test.ts`).

> **Workspace flag style.** This repo uses the space form
> (`--workspace @a14y/core`) consistently. The `=` form
> (`--workspace=@a14y/core`) also works but mixing them in scripts and
> docs makes diffs noisy.

## Visual / design parity

**Only relevant if your change touches `.astro` files or the global
stylesheet.** Skip this section otherwise.

The class-name audit catches unintended design drift:

```sh
# before your change
git stash
npm run build --workspace @a14y/docs
grep -hoE 'class="[^"]+"' packages/apps/docs/dist/index.html \
  | sort -u > /tmp/classes.before
git stash pop

# after your change
npm run build --workspace @a14y/docs
grep -hoE 'class="[^"]+"' packages/apps/docs/dist/index.html \
  | sort -u > /tmp/classes.after

diff /tmp/classes.before /tmp/classes.after
```

The diff must be empty unless the change is intentional design work.
Repeat for any other page you touched.

## Branching, commits, and PRs

- Branch per change. Use a prefix that matches the kind of work:
  `feature/...`, `fix/...`, `refactor/...`, `docs/...`, `chore/...`.
  Do not commit to `main` directly.
- **Use [Conventional Commits](https://www.conventionalcommits.org/).**
  The release pipeline (release-please) reads commit prefixes to decide
  which packages get a version bump. Examples:
  - `feat(core): add new heading-rhythm check`
  - `fix(extension): handle MV3 service-worker restart`
  - `feat(extension)!: drop options-page legacy schema` (breaking)
  - `chore:`, `docs:`, `ci:`, `test:` do **not** trigger a release.
  See [`RELEASING.md`](./RELEASING.md) for the full scope list and how
  the bot translates commits into version bumps.
- Reference any related issue in the commit body or PR description.
  Internal Linear IDs are fine; for external contributions, link the
  GitHub issue.
- Run the relevant test workspace before each commit (see
  [Tests](#tests)).
- Open a PR when the branch is ready. Do not merge to `main` without
  user confirmation.
- Pre-launch marketing/policy copy is flexible — feel free to suggest
  changes alongside structural work.

### Definition of done

Before you ask for review, confirm:

- [ ] Affected workspace tests pass locally.
- [ ] If you touched a check: the new check id appears in
      `draft.ts`, has a content file under `src/content/checks/`, and
      both `@a14y/core` and `@a14y/docs` test suites pass.
- [ ] If you touched `.astro` or global CSS: the class-name audit
      diff is empty (or the diff is intentional and called out in the
      PR).
- [ ] If you touched anything sourced under `docs/templates/` or
      `docs/fragments/`: you ran `npm run docs` and committed the
      regenerated READMEs.
- [ ] Commit messages follow Conventional Commits.
- [ ] No frozen `v0_*.ts` file was modified.
- [ ] If non-trivial rubric change: shipped via the
      [docs-first split](#docs-first-for-scorecard-changes) — the
      spec PR landed before this impl PR.

## Common pitfalls

- **Editing a frozen `v0_*.ts`.** These changes are not allowed and
  will be rejected — they break score reproducibility for every
  consumer pinned to that version. Always edit `draft.ts` instead.
- **Forgetting `_imports.ts`.** A new check file that isn't imported
  there won't be registered, and the registry-resolves test will fail
  with a confusing "unknown check id" message.
- **Frontmatter `id` mismatch.** The `id` in
  `src/content/checks/<id>.md` must equal both the filename and the
  pin in `draft.ts`. The coverage gate will fail the build otherwise.
- **Hand-editing a generated `README.md`.** All user-facing READMEs
  in this repo are generated. Edit `docs/templates/` or
  `docs/fragments/`, run `npm run docs`, and commit the regenerated
  output.
- **Stale draft pin after cut day.** When a draft is promoted to a
  frozen version, `draft.ts` is reseeded for the *next* version. If
  you branched before cut day, rebase before re-pinning.
- **Mixed `--workspace` flag styles.** Pick the space form to match
  the rest of the repo.

## Releases

Releases ship via [release-please](https://github.com/googleapis/release-please).
The bot keeps an open PR (`chore: release main`) on `main` that bundles
version bumps for every package whose Conventional Commits earn one.
Merging that PR publishes any bumped npm packages with provenance,
attaches a fresh Chrome-extension `.zip` to a GitHub Release, and
triggers a docs-site rebuild. See [`RELEASING.md`](./RELEASING.md) for
the full flow including CWS upload, escape hatches, and how to keep
the public release-notes page in sync.
