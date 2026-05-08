# Contributing to a14y

Thanks for your interest in a14y. This file is the entry point for
anyone editing the docs site, adding a check, or adding a new page.

The repo is organized as an npm workspaces monorepo. Most contributions
land in either `packages/apps/docs` (the a14y.dev site) or
`packages/core` (the scorecard registry and check implementations).

## Repo layout

```
agentready/
├── packages/
│   ├── apps/
│   │   ├── docs/         # a14y.dev — Astro site, content collections, mirror integration
│   │   ├── cli/          # `a14y` CLI (npm: a14y)
│   │   └── extension/    # Chrome extension
│   ├── core/             # scorecard registry, check implementations, types
│   ├── telemetry/        # shared opt-in telemetry helpers
│   └── aliases/          # npm-published name aliases for `a14y`
├── scripts/              # build-readmes and other repo-wide tooling
└── CONTRIBUTING.md       # this file
```

The site, CLI, and extension all consume `@a14y/core` for their checks
and scorecard data, so most "where do I add a check" answers live there.

## Editing the docs site (a14y.dev)

The docs site uses two different authoring directions depending on the
page. Pick the right one before you start editing.

### Prose-heavy pages → markdown is the source

Pages: `/glossary/`, `/privacy/`, `/scorecards/` (intro + tail).

Edit the matching file in `packages/apps/docs/src/content/pages/`:

| URL                | Source                                                         |
|--------------------|----------------------------------------------------------------|
| `/glossary/`       | `glossary.md`                                                  |
| `/privacy/`        | `privacy-intro.md` + `privacy-tail.md` (split around the opt-out button) |
| `/scorecards/`     | `scorecards-intro.md` + `scorecards-tail.md` (split around the synthesized version list) |

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

The scorecard ships as a set of frozen manifests plus one mutable
**draft**.

- **Published manifests** live at `packages/core/src/scorecard/v0_*.ts`
  (e.g. `v0_2.ts`). These are FROZEN: never edited after release so
  historical scores stay reproducible forever. Each one pins every
  stable check id to a single implementation version.
- **The draft manifest** lives at `packages/core/src/scorecard/draft.ts`
  and uses a semver pre-release version (e.g. `0.3.0-draft`). It is the
  contribution surface — PRs adding new check ids, bumping pinned
  implementation versions, or removing deprecated checks all land here.
  Consumers can preview it via `a14y check --scorecard draft` or at
  https://a14y.dev/scorecards/draft/.
- **Cut day**: the team copies `draft.ts` to a new frozen `v0_N.ts`,
  drops the `-draft` suffix, then reseeds `draft.ts` with the next
  planned version. See [`RELEASING.md`](./RELEASING.md#cutting-a-new-scorecard).

**You should never edit a `v0_*.ts` file.** Once shipped they are
immutable; editing one would silently break determinism for everyone
using that scorecard. All scorecard contributions go through `draft.ts`.

## Adding a new check

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
5. Run `npm test --workspace=@a14y/core` (registry resolves) and
   `npm test --workspace=@a14y/docs` (coverage gate passes).

## Updating an existing check

If a check's behavior should change (better detection, fewer false
positives, etc.):

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
4. Run the test suites listed under "Adding a new check".

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
npm run build --workspace=@a14y/docs
npm run preview --workspace=@a14y/docs
```

`npm run preview` runs a tiny custom static server
(`packages/apps/docs/scripts/preview.mjs`) that serves `dist/` with
the right Content-Type per file extension — including
`text/markdown; charset=utf-8` for `.md` mirrors so UTF-8 glyphs
(`✓`, `✗`, `✔`, `·`) render correctly. Astro's built-in
`astro preview` defaults to `text/markdown` with no charset, which
makes browsers fall back to Latin-1 and mojibake the output; the
custom script avoids that.

For HTML-only iteration, `npm run dev --workspace=@a14y/docs` is
faster.

## Tests

```sh
npm test --workspace=@a14y/docs   # vitest for the docs site
npm test                          # every workspace + the readme builder
```

Add or update tests with every code change:

- Unit tests live under `packages/<pkg>/test/` (vitest).
- The docs site has dedicated suites for the mirror integration
  (`test/markdown-mirrors.test.ts`), the HTML-to-markdown converter
  (`test/html-to-markdown.test.ts`), the page-substitutions remark
  plugin (`test/page-substitutions.test.ts`), and the coverage gate
  (`test/coverage.test.ts`).

## Visual / design parity

Any change that touches `.astro` files or the global stylesheet should
be checked for unintended design drift. The class-name audit is the
guardrail:

```sh
# before your change
git stash
npm run build --workspace=@a14y/docs
grep -hoE 'class="[^"]+"' packages/apps/docs/dist/index.html \
  | sort -u > /tmp/classes.before
git stash pop

# after your change
npm run build --workspace=@a14y/docs
grep -hoE 'class="[^"]+"' packages/apps/docs/dist/index.html \
  | sort -u > /tmp/classes.after

diff /tmp/classes.before /tmp/classes.after
```

The diff must be empty unless the change is intentional design work.
Repeat for any other page you touched.

## Branching, commits, and PRs

- One Linear issue per commit. Reference issue IDs in commit
  messages and PR descriptions.
- Branch per feature (`feature/...`, `fix/...`, `refactor/...`). Do
  not commit to `main` directly.
- Run `npm test --workspace=@a14y/docs` (and any other affected
  workspace) before each commit.
- Open a PR when the branch is ready. Do not merge to `main` without
  user confirmation.
- Pre-launch marketing/policy copy is flexible — feel free to suggest
  changes alongside structural work.

## Releases

Releases ship via [release-please](https://github.com/googleapis/release-please).
The bot keeps an open PR (`chore: release main`) on `main` that bundles
version bumps for every package whose Conventional Commits earn one.
Merging that PR publishes any bumped npm packages with provenance,
attaches a fresh Chrome-extension `.zip` to a GitHub Release, and
triggers a docs-site rebuild. See [`RELEASING.md`](./RELEASING.md) for
the full flow including CWS upload, escape hatches, and how to keep
the public release-notes page in sync.
