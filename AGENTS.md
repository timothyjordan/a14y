# AGENTS.md — a14y (Agent Readability)

Machine-readable invariants for coding agents working in this repo
(Claude Code, Codex, Cursor, OpenCode, etc.). For the longer
human-readable version, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Hard invariants

1. **Published scorecards are an immutable contract.** Once a
   scorecard version ships, it never changes — every consumer pinned
   to that version must keep getting the same score forever. This
   means:
   - Never modify `packages/core/src/scorecard/v0_*.ts`.
   - Never mutate an existing `'1.x.x'` entry under a check's
     `implementations` map. To change behavior, add a *new* entry
     (`'1.1.0'`) and pin it in `draft.ts`.
   - The contribution surface is
     `packages/core/src/scorecard/draft.ts` plus new
     `implementations` entries — never the past.
2. **Never hand-edit a `README.md`.** All user-facing READMEs are
   generated from `docs/templates/` and `docs/fragments/`. Edit the
   sources and run `npm run docs`.
3. **Never commit directly to `main`.** Branch as `feature/...`,
   `fix/...`, `refactor/...`, `docs/...`, or `chore/...`.
4. **Use [Conventional Commits](https://www.conventionalcommits.org/).**
   The release pipeline reads commit prefixes to decide version bumps.
   `chore:`, `docs:`, `ci:`, `test:` do not trigger a release.
5. **Frontmatter `id` in `src/content/checks/<id>.md` must equal the
   filename and the pin in `draft.ts`.** The coverage gate fails the
   build otherwise.
6. **If your change touches `draft.ts`, the `refresh-draft-diff`
   workflow MUST run before the PR is merged.** It regenerates
   `packages/core/src/scorecard/draft-changes.json` — the attribution
   data the docs site reads to render each diff entry on
   `/scorecards/draft/` and `/scorecards/draft/changes/`. It auto-runs
   on each push to PRs that modify `draft.ts`. If it didn't run (fork
   PR, workflow disabled, merged before the run completed), trigger
   it manually from `Actions → Refresh draft diff → Run workflow`. To
   preview the would-be JSON without pushing, run
   `node scripts/refresh-draft-diff.mjs --local`. Verify
   `draft-changes.json` reflects the net diff before requesting review.
7. **Non-trivial scorecard changes ship docs-first.** Split into two
   PRs: a **spec PR** (the check's `.md` page + the `draft.ts` pin,
   plus a stub `'1.1.0'` implementation copying the prior version
   when updating an existing check, so the pin resolves and tests
   stay green) lands and merges first; an **implementation PR** then
   replaces the stub with the real `'1.1.0'` handler. Rationale:
   prevents the spec PR and impl PR from pulling against each other
   while reviewers negotiate the contract. See
   [CONTRIBUTING → Docs-first for scorecard changes](./CONTRIBUTING.md#docs-first-for-scorecard-changes).

## Canonical commands

```sh
npm install
npm run build
npm test                           # every workspace + readme builder
npm test --workspace @a14y/core    # registry + check engine
npm test --workspace @a14y/docs    # mirror integration + coverage gate
npm run docs                       # regenerate READMEs from docs/
```

Use the space form (`--workspace @a14y/core`), not the `=` form, to
match the rest of the repo.

## Where things live

| Want to change… | Edit |
|---|---|
| A check's logic | `packages/core/src/checks/{site,page}/<file>.ts` (camelCase file name; one file may declare several related check ids — e.g. `llmsTxt.ts` declares `llms-txt.exists`, `.content-type`, `.non-empty`, `.md-extensions`). Add a new `'1.x.x'` entry under `implementations`; do not mutate existing ones. |
| Which checks are on the rubric | `packages/core/src/scorecard/draft.ts` |
| Wire a new check into the registry | `packages/core/src/scorecard/_imports.ts` |
| A check's docs page | `packages/apps/docs/src/content/checks/<id>.md` |
| Prose pages (glossary, privacy, scorecards intro/tail) | `packages/apps/docs/src/content/pages/*.md` |
| Landing page or `/spec/` design | `packages/apps/docs/src/pages/{index,spec}.astro` |
| HTML→markdown mirror rules | `packages/apps/docs/src/lib/html-to-markdown.ts` (+ test) |
| README content | `docs/templates/` and `docs/fragments/`, then `npm run docs` |

## Adding a new check (recipe)

> For non-trivial additions, split into spec + impl PRs (see
> invariant #7). The steps below are the impl PR.

1. Add `packages/core/src/checks/{site,page}/<file>.ts` with an
   `implementations` map keyed by `'1.0.0'`. The file name is
   camelCase; the check ids inside it are kebab-case and scoped
   (e.g. `llms-txt.exists`).
2. Import it in `packages/core/src/scorecard/_imports.ts`.
3. Pin it in `packages/core/src/scorecard/draft.ts`.
4. Add `packages/apps/docs/src/content/checks/<id>.md` with required
   frontmatter (`id`, `title`, `group`, `scope`, `why`).
5. Run `npm test --workspace @a14y/core` and
   `npm test --workspace @a14y/docs`.

## Updating an existing check (recipe)

> For non-trivial bumps, split into spec + impl PRs (see invariant
> #7). The steps below are the impl PR — the spec PR already shipped
> the `.md` page, the `draft.ts` pin bump, and a stub `'1.1.0'` copy
> of the prior handler; here you replace that stub with real logic.

1. In `packages/core/src/checks/{site,page}/<file>.ts`, add a new
   `'1.1.0'` (or higher) entry to `implementations`. **Leave the
   existing `'1.0.0'` entry untouched** — frozen scorecards reference
   it by version.
2. Bump the pin in `packages/core/src/scorecard/draft.ts`.
3. Update `packages/apps/docs/src/content/checks/<id>.md` if behavior
   changed.
4. Run the same test commands as above.

## Definition of done

Before opening a PR, confirm:

- [ ] Affected workspace tests pass.
- [ ] No `v0_*.ts` file was modified.
- [ ] If a check changed: `draft.ts` pin, content file, and
      `_imports.ts` are all consistent.
- [ ] If `.astro` or global CSS changed: class-name audit diff is
      empty or intentional (see CONTRIBUTING → "Visual / design
      parity").
- [ ] If anything under `docs/templates/` or `docs/fragments/`
      changed: `npm run docs` was run and the regenerated READMEs are
      committed.
- [ ] If `draft.ts` changed: the `refresh-draft-diff` workflow ran on
      the PR head and `packages/core/src/scorecard/draft-changes.json`
      reflects the net diff with attribution. See
      [CONTRIBUTING → Diff refresh workflow](./CONTRIBUTING.md#diff-refresh-workflow).
- [ ] If non-trivial rubric change: docs-first split was used — the
      spec PR landed before this impl PR (see invariant #7).
- [ ] Commits follow Conventional Commits.

## Further reading

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — full contribution guide.
- [`RELEASING.md`](./RELEASING.md) — release flow, Conventional
  Commits scopes, release-please mechanics.
- [`TESTING.md`](./TESTING.md) — manual smoke-test recipes for the
  CLI, Chrome extension, and docs site.
