<!-- include: fragments/_hero.md -->

<!-- include: fragments/_links.md -->

<!-- include: fragments/_install.md -->

<!-- include: fragments/_usage.md -->

## Command reference

The sections below are generated from the CLI's own `--help` output, so they stay in sync with the code.

### `a14y --help`

<!-- cli-help: root -->

### `a14y help check`

<!-- cli-help: check -->

### `a14y help scorecards`

<!-- cli-help: scorecards -->

## Repository layout

This repo is an npm workspace:

- `packages/apps/cli` — the `a14y` binary (this CLI).
- `packages/core` — `@a14y/core`, the library that implements scoring, crawling, and report generation. Consumed by the CLI and by the Chrome extension.
- `packages/apps/extension` — Chrome extension (internal, not published to npm).
- `packages/apps/docs` — Astro site published at <https://timothyjordan.github.io/a14y/>.
- `packages/aliases/*` — thin wrapper packages that re-export the CLI under `agentready` and `agentreadability`.

## Contributing

```bash
npm install
npm run build
npm test
npm run docs     # regenerate every README from docs/
```

All user-facing READMEs in this repo (this one, `packages/apps/cli/README.md`, `packages/core/README.md`, and the alias READMEs) are generated from `docs/templates/` + `docs/fragments/`. Edit the source files and run `npm run docs` — never hand-edit a generated README.

<!-- include: fragments/_license.md -->
