---
title: Release notes · a14y
description: A reverse-chronological log of what's shipped on a14y.dev, the CLI, the Chrome extension, the scorecard, and the agent skill.
---

## 2026-05-16 — Per-site OG cards

- Every per-site scorecard under `/leaderboard/[site]/` ships its own Open Graph card, so links shared to social or chat preview the score, the site, and its category at a glance.


## 2026-05-15 — Marketing rebuild + first community-shaped checks

- Rebuilt landing page at a14y.dev: clearer "what it is, who it's for, what running it looks like." (Old `/research/` URL is now `/leaderboard/` to match.)
- New press kit at `/press/`: one-pager, logo lockups, and ready-to-paste product screenshots.
- Three new draft scorecard checks under `markdown.*` shipped spec-first, then implementation: a complete end-to-end example for community contributors to model from.
- Site crawler memory bounded so large-catalog audits no longer OOM.


## 2026-05-13 — Landing page around the badge + draft scorecard diffs

- Landing page relaunched around the embeddable readability badge: show your score, link to your scorecard, share it anywhere.
- Draft scorecards now render an inline diff against the latest published version, so reviewers see exactly what would change before it lands.


## 2026-05-08 — Shareable scores everywhere + community draft scorecards

- One shareable score summary across the CLI, the Chrome extension, and the agent skill. Every surface emits the same paste-ready output and badge URL.
- Embeddable a14y badge: any site can drop in a live score badge sourced from a14y.dev.
- Per-site scorecard pages: each leaderboard entry now has its own deep-link URL with the full check breakdown.
- Draft scorecard workflow opens contributions: anyone can propose a check change with spec, implementation, and a reviewable diff against the published scorecard.


## 2026-05-06 — Chrome Web Store launch + 234-site readability leaderboard

- The a14y Chrome extension is live on the Chrome Web Store. Install once, audit any page from the toolbar.
- New `/research/` page: an agent-readability leaderboard ranking 234 sites, with score histograms, category breakdowns, a hardest-checks ranking, and a deep-link scorecard for every entry. The first public answer to "how readable is the web for agents?"


## 2026-05-06 — Skill v0.2.0

- Pinned the agent skill at `metadata.version 0.2.0` so installs are versionable and indexable.
- Itemized-checklist plan: every fix proposed by the skill is its own row the user can keep or skip — no monolithic "approve all".
- Design-matching guardrails: the skill must read the project's existing layout and styles before adding any user-facing content.


## 2026-05-05 — Open agent skill

- Installable into any spec-compliant agent — Claude Code, Codex, Cursor, OpenCode — with `npx skills add timothyjordan/a14y`.
- Published the a14y agent skill under `/.well-known/agent-skills/` per the Cloudflare Agent Skills Discovery RFC.
- Every page on a14y.dev advertises the skill via `<link rel="agent-skills">` so agents can pick it up automatically.


## 2026-05-03 — Crawler hygiene

- Crawler stops chasing phantom URLs harvested from `.md` mirrors, so site-mode audits no longer surface non-routes as failing pages.


## 2026-04-28 — Telemetry across all surfaces

- Anonymous GA4 events from the CLI, the Chrome extension, and the docs site so we can see which checks people actually rely on.
- Opt-out is one click on the docs at `/privacy/`, one toggle in the extension options, and `--no-telemetry` on the CLI.


## 2026-04-23 — Renamed `agentready` → `a14y`, default-command CLI, dark mode

- Project name and npm package are now `a14y` — the homophone of "a11y" makes the agent-readability framing legible at a glance. The legacy package names remain installed as aliases.
- `a14y check <url>` is the default CLI invocation; the bare `a14y <url>` form also works for quick audits.
- Manual light/dark toggle on a14y.dev with the user's choice winning over OS preference.


## 2026-04-07 — Agent fix-prompt output

- `--output agent-prompt` produces a markdown plan an LLM can execute end-to-end: ranked failing checks, affected URLs, and re-run instructions in one document.
- Now the audit isn't just a score — it's a hand-off to the coding agent that's going to fix the site.

## 2026-04-06 — v0.2.0 launch

- First public scorecard pinning 38 checks across the three layers of agent readability — discoverability, parsing, and comprehension.
- CLI, Chrome MV3 extension, and Astro docs site shipped together so the same engine evaluates a site whether you run it from the terminal, the toolbar, or your CI.
