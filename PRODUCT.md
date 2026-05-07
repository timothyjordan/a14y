# Product

## Register

brand

## Users

Frontline web developers, technical writers, and DX/PM-leaning engineers at companies whose product is partly consumed by AI agents (docs sites, marketing sites, API references, knowledge bases). They're already comfortable with terminal tools — `npm install -g`, `chrome://extensions`, conventional commits — but they're skeptical of marketing fluff. They visit a14y.dev to (1) understand what "agent readability" even means, (2) score their own site, (3) decide whether the open spec is something they can adopt without locking in.

A secondary audience: agent-builders and infra engineers (Claude Code, Cursor, Continue) who'd cite or follow the spec.

## Product Purpose

a14y is the **open spec, the versioned scorecard, and the tools** for measuring how well any website can be discovered, parsed, and comprehended by AI agents. The website itself (a14y.dev) is the canonical home for the spec, the scorecard, and the install paths into the tools (CLI + Chrome extension). Success looks like:

- A developer lands on a14y.dev, audits their site within 30 seconds (`npx a14y …` or installing the extension), and walks away with concrete fix items.
- The spec accrues citations from agent vendors and other readability projects.
- Scorecard versions become the shared vocabulary the way WCAG levels are for human accessibility.

This is pre-launch — public copy and brand stances are still flexible.

## Brand Personality

**Three words:** technical, candid, generative.

- **Technical** — fluent in dev jargon (CLI flags, manifests, conventional commits) without translation. Treats readers as engineers, not "users".
- **Candid** — admits where the work is incomplete (`Coming soon`, `stop-gap`, `pre-launch`). Doesn't oversell. Talks about checks failing as readily as checks passing.
- **Generative** — leaves room for agent-builders to reuse the work. Spec, scorecard, sitemap, AGENTS.md, llms.txt, agent-skills/index.json — every page has a `.md` mirror, every surface is replicable.

The voice is closer to a Linear changelog or a Stripe API doc than to a SaaS marketing page. Comfortable with semicolons, parentheses, and footnotes. No exclamation marks, no "🚀", no "supercharge".

## Anti-references

- **Generic dev-tool SaaS** (Vercel-clone landing pages with the same hero-stat-grid + glassmorphism + animated gradient mesh).
- **Compliance-product clinicalism** (axe / Lighthouse-style "we tell you what's broken" tone, devoid of point of view).
- **Spec-doc dryness** (W3C-style walls of `MUST`/`SHOULD`/`MAY` with zero design).
- **Agent-hype** ("AI-native", "the future of the web", lottie-animated robot mascots).

References that *do* feel right: Linear's docs, Stripe's API reference, the WHATWG HTML spec landing pages, npmjs.com package pages, terminal-native tools' marketing (e.g., Raycast, Warp's docs).

## Strategic Design Principles

1. **Agents are first-class readers.** Every page has a markdown mirror. Discovery files (`llms.txt`, `AGENTS.md`, `sitemap.md`, `.well-known/agent-skills/`) are part of the site, not afterthoughts. The site's own a14y score is a marketing asset.
2. **Show the score, not the pitch.** The hero on the home page renders sample CLI output, not a stock illustration. Concrete output → trust.
3. **Versioned, not aspirational.** Scorecard, spec, and tool versions are visible in the eyebrow on every page. Readers should always know which version they're looking at.
4. **CLI parity with the GUI.** Anything the Chrome extension can do, the CLI can do. The website's job is to make the install path obvious for both.
5. **Stop-gaps are fine if labeled.** While CWS approval is pending, "load unpacked from this .zip" is a stop-gap install. The page admits this rather than hiding it.

## Accessibility

- WCAG 2.1 AA target for color contrast and keyboard navigation.
- Reduced-motion: minimal motion to begin with; ensure CSS respects `prefers-reduced-motion`.
- Light + dark theme parity (existing site supports both via `[data-theme]`).

## Notes

This file was synthesized from the existing site copy at a14y.dev, the project's CLAUDE-memory positioning entries, and the visible CSS tokens in `packages/apps/docs/src/styles/global.css` (oklch palette: navy ink, quiet cyan, warm off-white, terra signal). For a fully-authoritative PRODUCT.md the user should run `$impeccable teach` once the project is closer to public launch.
