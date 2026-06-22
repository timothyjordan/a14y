# Releasing a14y

This repo ships three things to three different places: npm packages, a
Chrome extension, and the docs site at <https://a14y.dev>. This file
explains how each one is released, what humans need to do, and what's
automated.

## Quick reference

| Surface | Trigger | Versioned by | Distribution | Manual step |
|---|---|---|---|---|
| `@a14y/core`, `@a14y/telemetry`, `a14y` CLI, `agentready`, `agentreadability` | merge release-please PR | release-please from Conventional Commits | npm (provenance via OIDC) | none (release notes are auto-published; edit after the fact if needed) |
| Chrome extension (`@a14y/extension`) | merge release-please PR | release-please from `feat(extension):` / `fix(extension):` | `.zip` attached to `extension-v<version>` GitHub Release | upload `.zip` to Chrome Web Store |
| Docs site (a14y.dev) | push to `main` (paths-filtered) **or** completion of any Release run | none | GitHub Pages | none |
| Release notes page (a14y.dev/release-notes/) | edit `packages/apps/docs/src/content/pages/release-notes.md` | none — hand-curated | Deployed with docs site | write the entry |

The single human action that actually ships a release is **merging the
"chore: release main" PR** that the [release-please](https://github.com/googleapis/release-please)
bot keeps open on `main`. That one merge publishes any bumped npm
packages and attaches a fresh extension `.zip` to a GitHub Release. The
docs site rebuilds afterwards on its own.

## A. npm packages — CLI, core, telemetry, aliases

**Trigger:** merge the bot's "chore: release main" PR. Don't run
`npm publish` by hand.

**Versioning:** [Conventional Commits](https://www.conventionalcommits.org/) drive
the bumps. `fix:` is patch, `feat:` is minor, `chore:` / `docs:` /
`ci:` / `test:` don't bump anything. Use a scope to target the right
package: `feat(core): …`, `fix(cli): …`, `feat(telemetry): …`. An
unscoped commit is mapped by the workspace path it touched.

`a14y`, `agentready`, and `agentreadability` always move together via
the `linked-versions` plugin (`groupName: a14y-cli`) in
`release-please-config.json`. A bump to `@a14y/core` triggers a patch
bump of every workspace that depends on it via the `node-workspace`
plugin.

**What merging the PR does:**

1. release-please re-runs on the merge commit, sees the manifest match,
   creates the git tag (`core-v<version>`, `a14y-v<version>`, etc.) and a
   **published** GitHub Release per package. The tag is what advances the
   "already released" boundary, so these releases must publish, not sit as
   drafts (see "Why not drafts?" below).
2. The `publish` job in `.github/workflows/release.yml` matrix-fans
   across each released path (excluding `packages/apps/extension`,
   which isn't on npm).
3. For each path: upgrade npm to 11+ (Trusted Publishing requires it),
   `npm install` to reconcile root `package-lock.json` drift,
   build in topological order (`@a14y/core` → `@a14y/telemetry` → CLI;
   aliases ship `bin.js` only and skip the build), run that workspace's
   tests, then `npm publish --provenance --access public`.

**Auth:** OIDC Trusted Publishing on npmjs.com — no `NPM_TOKEN`
secret. Each package needs its Trusted Publisher configured once on
[npmjs.com](https://www.npmjs.com/), pointing at this repo + the
`Release` workflow.

**Why not drafts?** These releases publish immediately rather than as
drafts. A draft GitHub Release does not create its git tag (GitHub only
creates the tag on publish), and release-please uses the latest per-package
tag to find the "already released" boundary. When these packages were
configured with `draft: true`, the tags froze at the last published version
and every run re-derived the entire history as unreleased, opening a fresh
release PR after every merge in an infinite loop. Publishing on merge keeps
the tags current and the boundary correct. The npm publish is still the
binding action; the GitHub Release is for human-readable notes, which you
can edit on the [Releases](https://github.com/timothyjordan/a14y/releases)
page anytime after they go out.

**Lockfile note:** release-please bumps workspace `package.json`
versions but does not update root `package-lock.json`, so the publish
job runs `npm install` (not `npm ci`). The lockfile inside each
published tarball is unaffected.

### Escape hatch: republish one package

If a publish step fails after release-please has already cut the tag,
don't re-run release-please. Use the manual escape hatch:

1. Go to `Actions` → **Release** workflow → **Run workflow**.
2. Set the `path` input to the workspace path (e.g., `packages/core`).
3. Run.

The workflow's `if:` conditions skip release-please on
`workflow_dispatch` and run only the `publish` job for the named path.
Don't use this for routine releases — let release-please drive those.

## B. Chrome extension

The extension is just another package in `release-please-config.json`,
so it ships through the same release-please PR as the npm packages.
The CWS upload is still manual, but the artifact it consumes is now
produced automatically.

**Trigger:** merge the same "chore: release main" PR.

**Versioning:** Conventional Commits scoped to `extension`:
`feat(extension): …` (minor), `fix(extension): …` (patch).
release-please bumps both
`packages/apps/extension/package.json` **and**
`packages/apps/extension/manifest.json` via the `extra-files` jsonpath
rule. The two must always stay aligned — Chrome Web Store rejects
uploads where they drift.

**What merging the PR does:**

1. release-please tags `extension-v<version>` and creates a published
   (not draft) GitHub Release. It must be published because the docs
   site filters out drafts and prereleases when querying the Releases
   API.
2. The `publish-extension` job in `release.yml` builds `@a14y/core` +
   `@a14y/telemetry` + the extension, runs
   `npm run package --workspace @a14y/extension` to produce
   `a14y-extension-<version>.zip`, and `gh release upload --clobber`'s
   the zip to the release.
3. `deploy-docs.yml`'s `workflow_run` trigger fires on the successful
   `Release` run, the docs site rebuilds, and
   `getLatestExtensionRelease()` (in
   `packages/apps/docs/src/lib/extension-release.ts`) re-queries the
   Releases API at build time. The `/chrome-extension/` page's
   download CTA updates to point at the new zip.

The per-commit `extension.yml` workflow is **not** a release path — it
runs on every push to `main` purely as a smoke build, and uploads a
workflow artifact you can grab off any branch via `workflow_dispatch`.
Don't use it to ship.

### Submit to Chrome Web Store

The CWS upload is the only manual step in the extension flow. The
artifact is produced for you; you just have to upload it.

The detailed step-by-step (which copy goes in which CWS field) lives in
[`packages/apps/extension/README.md`](./packages/apps/extension/README.md#submit-to-chrome-web-store).
Short version:

1. Download `a14y-extension-<version>.zip` from the
   [latest extension release](https://github.com/timothyjordan/a14y/releases?q=extension-v).
2. Upload it via the
   [Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole).
3. Paste listing fields from `packages/apps/extension/store/listing.md`,
   permission justifications from `permissions.md`, the single-purpose
   statement from `single-purpose.md`, and the screenshots from
   `screenshots/`.
4. Submit for review.

## C. Cutting a new scorecard

The scorecard rubric ships as a set of frozen TypeScript manifests
under `packages/core/src/scorecard/v0_*.ts`. Contributions accumulate in
the mutable `draft.ts` (e.g. `0.3.0-draft`) — see
[`CONTRIBUTING.md`](./CONTRIBUTING.md#scorecard-lifecycle). When the
team decides the draft is ready, follow this procedure to "cut" it into
a frozen release.

**Pre-flight:**

- No in-flight PRs touching `packages/core/src/scorecard/draft.ts`.
- Every check id pinned by the draft has a docs page at
  `packages/apps/docs/src/content/checks/<id>.md` (the docs build
  enforces this via `assertCoverage`).
- All tests pass on `main`: `npm test`.

**Procedure** (replace `0_3` and `0.3.0` / `0.4.0-draft` with the actual
versions you're cutting):

1. **Freeze the draft.** Copy `draft.ts` to a new frozen file:

   ```sh
   cp packages/core/src/scorecard/draft.ts packages/core/src/scorecard/v0_3.ts
   ```

   In `v0_3.ts`:
   - Rename the export from `SCORECARD_DRAFT` to `SCORECARD_0_3_0`.
   - Drop the `-draft` suffix from `version` (e.g. `0.3.0`).
   - Set `releasedAt` to today's date (`YYYY-MM-DD`).
   - Replace the file-level "draft" comment with a "FROZEN" comment
     mirroring the prose in `v0_2.ts`.

2. **Register the new manifest.** In
   `packages/core/src/scorecard/index.ts`:
   - Import `SCORECARD_0_3_0` from `./v0_3`.
   - Add it to `SCORECARDS` keyed by `'0.3.0'`.
   - Update `LATEST_SCORECARD` to `'0.3.0'`.

3. **Open the next draft.** Rewrite `draft.ts` to seed from the
   freshly cut manifest:

   ```ts
   import type { ScorecardManifest } from './types';
   import { SCORECARD_0_3_0 } from './v0_3';

   export const SCORECARD_DRAFT: ScorecardManifest = {
     version: '0.4.0-draft',
     releasedAt: 'unreleased',
     description: '...',
     checks: { ...SCORECARD_0_3_0.checks },
   };
   ```

4. **Update tests.** The strict assertions in
   `packages/core/test/scorecard.test.ts` are anchored to v0.2.0 today;
   when v0.3.0 becomes the latest, port the strict invariants there
   (count, expected check ids) and update the `LATEST_SCORECARD`
   assertion. The permissive `scorecard.draft.test.ts` does not need
   to change.

5. **Add release notes.** Append a dated entry to
   `packages/apps/docs/src/content/pages/release-notes.md`
   summarizing the cut: which checks are new, which were bumped, and
   which were dropped (if any). Reference the cut PR.

6. **Verify locally.**

   ```sh
   npm test --workspaces --if-present
   npm run build --workspaces --if-present
   ```

7. **Open the PR.** Use a Conventional Commit on the `core` scope:

   - **Minor bump** (`feat(core): cut scorecard 0.3.0`) when only new
     checks were added or impl versions bumped.
   - **Major bump** (`feat(core)!: cut scorecard 0.3.0`) when any
     existing check id was removed or its scope changed in a way that
     would break a consumer pinned to the previous scorecard.

   Per-package CHANGELOGs are still auto-generated by release-please —
   don't hand-edit them.

> Automation note: a `scripts/cut-scorecard.mjs` helper that
> performs steps 1–3 atomically is on the roadmap. Until then this is
> a manual procedure.

## D. Docs site (a14y.dev)

Continuous deployment — no version, no PR to merge. Two triggers in
`.github/workflows/deploy-docs.yml`:

- **Push to `main`** that touches `packages/apps/docs/**`,
  `packages/core/**`, the deploy-docs workflow itself, `package.json`,
  or `package-lock.json`.
- **Successful completion of any `Release` run** (via `workflow_run`),
  so `/chrome-extension/` and any other page that reads from the
  GitHub Releases API picks up new release metadata.

The build runs `@a14y/core`'s build first (the docs site imports
scorecard manifests from its `dist/`), then Astro builds the docs
package, then the artifact is deployed to GitHub Pages. The
concurrency group cancels in-flight deploys when a newer one lands.

The `version` field in `packages/apps/docs/package.json` is unused —
the package is `private` and never published. Don't bump it expecting
it to mean anything.

## E. Release notes

There are two different "changelogs" in this repo. Don't confuse them.

- **`packages/apps/docs/src/content/pages/release-notes.md`** is the
  user-facing release notes page at <https://a14y.dev/release-notes/>.
  Hand-curated prose. Edit it whenever you ship something worth
  surfacing publicly. The next docs deploy picks it up.
- **Per-package `CHANGELOG.md`** (next to each `package.json`) is
  auto-generated by release-please from Conventional Commits. **Don't
  edit by hand** — release-please rewrites them on every release PR.

When you cut a release that's worth announcing, add a dated entry at
the top of `release-notes.md`. Keep the format consistent with the
existing entries: `## YYYY-MM-DD — Headline`, then bullets, then a
link to the relevant PR(s).

## Common pitfalls

- A PR with only `chore:`, `docs:`, `ci:`, `test:`, or non-conventional
  commits won't bump anything. The release-please PR refreshes anyway,
  just without contributions from that PR.
- Touching only `packages/apps/docs/**`, `.github/**`, `scripts/**`,
  `skills/**`, or top-level docs does not bump npm packages. The
  extension only moves on `feat(extension):` / `fix(extension):`
  commits.
- If `manifest.json` and `package.json` versions for the extension
  drift, CWS will reject the upload. release-please keeps them
  aligned via `extra-files`; manual edits will break that invariant.
- Force-pushing to `main` or rewriting commit history confuses
  release-please. It looks at commits since the last release tag —
  rewritten history breaks bump detection.
- The bot rewrites the entire release-please PR body on every push to
  `main`. Don't make manual edits to that PR's description; they'll
  be lost on the next refresh. To change the preamble, edit
  `pull-request-header` / `pull-request-footer` in
  `release-please-config.json`.

## Source of truth

These files own the behavior described here. RELEASING.md is just a
guide.

- `release-please-config.json` — package list, linked versions,
  workspace ripple plugin, PR header/footer text.
- `.release-please-manifest.json` — current versions per workspace.
- `.github/workflows/release.yml` — release-please job + npm `publish`
  job + `publish-extension` job.
- `.github/workflows/deploy-docs.yml` — docs deploy + `workflow_run`
  trigger on Release.
- `.github/workflows/extension.yml` — per-commit smoke build (not a
  release path).
- `packages/apps/docs/src/lib/extension-release.ts` — how the docs
  site discovers the latest extension release at build time.
- `packages/apps/extension/README.md` — extension build + CWS upload
  details.
