---
title: Glossary · a14y
description: Definitions for the core terms used in the a14y scorecard, CLI, and Chrome extension.
---

## Scorecard

A versioned manifest pinning each stable check id to a specific
implementation version. Scorecards are frozen once published:
changes go into a new file (e.g. `v0_3.ts`) so older
audits remain reproducible. The current scorecard is
**v{{LATEST_VERSION}}**.

## Check

A single rule the scorecard evaluates against a site or a page.
Each check has a stable id (e.g. `html.canonical-link`),
a scope (site or page), a group label for UI rendering, and one
or more implementation versions describing the actual logic.

## Check id

A stable, never-renamed identifier for a check (e.g.
`llms-txt.exists`, `markdown.mirror-suffix`).
Even if the check name or implementation changes, the id stays
the same so historical results compare cleanly.

## Implementation version

Per-check semver string. Bumped whenever the check's observable
behaviour changes. Old versions stay in the registry forever so
frozen scorecards can keep evaluating their pinned implementations.

## Scope

Either `site` (run once per audit, against the audited
origin) or `page` (run once per discovered page). Site
checks cover discoverability surfaces like llms.txt and robots.txt;
page checks cover HTML metadata, structured data, content
structure, and markdown mirrors.

## Group

A human-readable category label attached to each check, used to
cluster checks by topic in reports (e.g. "HTML metadata",
"Discoverability", "Markdown mirror"). Purely cosmetic. The
score itself doesn't depend on it.

## Pass / Fail / Warn / Error / N/A

Every check returns one of five statuses:

- **pass**: the rule is satisfied.
- **fail**: the rule is not satisfied. Counts against the score.
- **warn**: soft fail. Reported separately but treated as not-passed for scoring.
- **error**: the check threw unexpectedly. Treated as not-passed.
- **n/a**: the rule does not apply to this page (e.g. `api.schema-link` on a non-API page). Excluded from both halves of the score.

## Applicable

The denominator of the score formula:
`applicable = total - na`. Only checks that meaningfully
apply to the audited content count. The score itself is
`round(passed / applicable * 100)`.

## Manifest

The frozen TypeScript file (e.g. `v0_2.ts`) that pins
each check id in a scorecard to a specific implementation version.
The runtime resolver throws if any pinned id or version is missing
from the registry, so a frozen scorecard can never silently drift.

## Parity

The contract that the CLI and the Chrome extension produce
byte-identical scores for the same URL + scorecard version.
Enforced by `parity.test.ts` in `@a14y/core`.

## Subpath

A docs site hosted under a path on a shared domain (e.g.
`https://timothyjordan.github.io/a14y/`) rather
than at its own origin root. Site-level checks like
`llms-txt.exists` look for files at both the subpath
and the origin root, preferring the subpath copy.

## Mirror

A markdown version of an HTML page, served at the same URL with
a `.md` suffix. Agents prefer mirrors because they
don't have to parse HTML or run JavaScript to read the content.
Documented in detail under
`markdown.mirror-suffix`.
