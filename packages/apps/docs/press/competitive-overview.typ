// =============================================================
// a14y — Competitive overview (request-only press PDF)
//
// Source of truth: a14y-internal2/docs/launch-plan.md §1 and the
// long-form analyses under a14y-internal2/packages/research/
// competitive-analysis/.
//
// Build:  pnpm --filter @a14y/docs gen:press-pdf
// Output: public/press/a14y-competitive-overview-vYYYY-MM.pdf
// Brand tokens mirror packages/apps/docs/src/styles/global.css.
// =============================================================

// --- Brand tokens (OKLCH; mirrors global.css) ----------------
#let brand-paper   = oklch(98.5%, 0.008, 90deg)
#let brand-ink     = oklch(27%,   0.10,  268deg)
#let text-body     = oklch(22%,   0.03,  268deg)
#let text-muted    = oklch(50%,   0.025, 268deg)
#let text-subtle   = oklch(65%,   0.02,  268deg)
#let border-soft   = oklch(88%,   0.012, 90deg)
#let border-strong = oklch(78%,   0.015, 90deg)
#let signal        = oklch(55%,   0.15,  35deg)
#let surface-alt   = oklch(95.5%, 0.012, 90deg)

// --- Document metadata ---------------------------------------
#set document(
  title: "a14y — Competitive overview (v2026-05)",
  author: "a14y · Timothy Jordan",
  keywords: ("a14y", "competitive analysis", "AI agents", "press"),
)

// --- Page setup ----------------------------------------------
#set page(
  paper: "us-letter",
  margin: (top: 0.55in, bottom: 0.55in, left: 0.75in, right: 0.75in),
  fill: brand-paper,
  footer: context [
    #set text(size: 8pt, fill: text-subtle, font: "Atkinson Hyperlegible Next")
    #grid(
      columns: (1fr, 1fr, 1fr),
      align: (left, center, right),
      [a14y.dev],
      [Request-only · not for redistribution],
      [#counter(page).display() / #counter(page).final().last()],
    )
  ],
)

#set text(
  font: "Atkinson Hyperlegible Next",
  size: 10pt,
  fill: text-body,
  lang: "en",
)

#set par(leading: 0.55em, justify: false)

#show heading.where(level: 1): set text(size: 18pt, weight: "bold", fill: brand-ink)
#show heading.where(level: 2): it => {
  v(0.1in)
  text(
    size: 9.5pt,
    weight: "bold",
    fill: brand-ink,
    font: "JetBrains Mono",
    upper(it.body),
  )
  v(0.02in)
}

// --- Top metadata ribbon -------------------------------------
#grid(
  columns: (1fr, auto),
  align: (left + horizon, right + horizon),
  text(size: 11pt, weight: "bold", fill: brand-ink, font: "JetBrains Mono")[a14y],
  text(size: 9pt, fill: signal, font: "JetBrains Mono")[v2026-05 · request-only],
)
#v(0.1in)

// --- Title ----------------------------------------------------
= Competitive overview

#v(0.02in)
#text(size: 12pt, fill: text-muted)[
  *Lighthouse for AI agents.* Open spec, open CLI, public leaderboard.
]
#v(0.1in)

#text(size: 9.75pt, fill: text-body)[
  a14y is an open-source agent-readability scorecard: ~38 fast checks
  across 3 layers, scanning any deployed site for whether AI agents
  (Claude, Perplexity, ChatGPT) can discover, parse, and act on it. The
  output is a per-page numeric score with JSON for CI, plus a public
  238-site leaderboard. The comparison below is the most current view of
  where a14y sits relative to other named scorecards in the space.
]
#v(0.14in)

// --- Table ---------------------------------------------------
#let yes  = text(weight: "bold", fill: brand-ink, size: 11pt)[✓]
#let no   = text(fill: text-subtle, size: 11pt)[✗]
#let part = text(weight: "bold", fill: signal, size: 11pt)[\~]

#table(
  columns: (1.45fr, 0.7fr, 1.05fr, 1.15fr, 1.0fr, 1.0fr),
  align: (left + horizon, center + horizon, center + horizon, center + horizon, center + horizon, center + horizon),
  stroke: 0.5pt + border-strong,
  fill: (col, row) => if row == 0 { surface-alt } else { none },
  inset: 5.5pt,
  // Header row
  [],
  text(size: 9pt, weight: "bold", fill: brand-ink)[a14y],
  text(size: 9pt, weight: "bold", fill: brand-ink)[ora.ai \ #text(size: 7pt, weight: "regular", fill: text-muted)[(formerly ora.run)]],
  text(size: 9pt, weight: "bold", fill: brand-ink)[Cloudflare \ #text(size: 7pt, weight: "regular", fill: text-muted)[isitagentready.com]],
  text(size: 9pt, weight: "bold", fill: brand-ink)[agentready.dev],
  text(size: 9pt, weight: "bold", fill: brand-ink)[scan-then-sell #super[¹]],
  // Row 1
  text(size: 9.5pt)[Open implementation], yes, no, no, no, no,
  // Row 2
  text(size: 9.5pt)[Public leaderboard], yes, yes, no, no, no,
  // Row 3
  text(size: 9.5pt)[Per-page scores], yes, no, no, yes, no,
  // Row 4
  text(size: 9.5pt)[CI-friendly (sub-second)], yes, no, no, no, no,
  // Row 5
  text(size: 9.5pt)[Vendor-neutral], yes, part, no, part, no,
  // Row 6
  text(size: 9.5pt)[Sells the fix?], no, part, part, part, yes,
)

#v(0.08in)
#text(size: 7.5pt, fill: text-subtle, style: "italic")[
  Legend: #text(fill: brand-ink, weight: "bold")[✓] yes ·
  #text(fill: text-subtle)[✗] no ·
  #text(fill: signal, weight: "bold")[\~] partial.
  #super[¹] Aggregate of sitespeak.ai, StartDesigns, agnt.one Site Checker, and similar lead-gen scanners — see Wider landscape, page 2.
]

#v(0.12in)

// --- Tier-1 positioning paragraphs ---------------------------
== ora.ai (formerly ora.run)

#text(size: 9.5pt)[
  The most fully-realized agent-readiness product on the market. Separates
  an open standard — *AgentReady*, MIT-licensed, vendor-neutral,
  semver-governed — from a proprietary reference implementation
  (*Deep Scan v1.1*, 113 checks across 5 weighted layers, F→A+ letter
  grades, ~9,982 sites scanned). Live agent execution (real OAuth, real
  MCP, multi-turn goal completion across LLM providers) is its wedge;
  a14y intentionally stays on fast static checks. Recently rebranded with
  a sharper emphasis on Answer Engine Optimization.
]

== Cloudflare · isitagentready.com

#text(size: 9.5pt)[
  Launched 2026-04-17 during Cloudflare's Agents Week. Free, proprietary,
  MCP-queryable; five RFC-aligned dimensions (Discoverability, Content,
  Bot Access Control, Protocol Discovery, Commerce). No leaderboard —
  one-shot scans only. Cloudflare positions it as "Lighthouse for AI
  agents," the same narrative slot a14y stakes out, but funnels users into
  Workers / AI Gateway / URL Scanner. Score formula not publicly documented.
]

== agentready.dev

#text(size: 9.5pt)[
  Single-purpose 7-check scanner focused on Markdown content negotiation
  and adjacent signals. Top-of-funnel for *TokenCut*, a commercial
  prompt-compression proxy. Closer to a single check group of a14y
  packaged as a stand-alone product than a peer scorecard.
]

#pagebreak()

// --- Page 2 --------------------------------------------------
= Wider landscape

#v(0.02in)
#text(size: 10pt, fill: text-muted)[
  Seven additional entrants surfaced in the May 2026 sweep. None of them
  shifts a14y's four moats; together they sharpen them.
]
#v(0.1in)

#text(size: 9.5pt)[
  *Stytch* — auth-as-a-service for AI agents (OAuth, MCP, agent detection).
  Not a scanner; sells the auth layer that ora.ai, Cloudflare, and a14y
  all *check for*. Featured in Anthropic's #link("https://www.agentreadyapps.com/")[agentreadyapps.com]
  masterclass (Episodes 4 and 7). \
  *ambient-code/agentready* — MIT open-source scanner with ~128 stars on
  GitHub. Scans *git repositories* for AI-assisted-development readiness
  (CLAUDE.md, test execution, type annotations) — a fundamentally
  different axis from a14y's deployed-site scanner. Name-space adjacency,
  not competition. \
  *sitespeak.ai* and *StartDesigns* — scan-then-sell-the-fix lead-gen for
  a chatbot SaaS and an agency, respectively. Both bundle remediation as
  the product. \
  *agnt.one Site Checker* — diagnostic transparency rather than scoring;
  shows the raw text payload an agent extracts ("AI Knowledge Preview").
  The single strongest idea from the sweep — a14y will likely adopt an
  equivalent "AI View" mode. \
  *agentreadyapps.com* — *not a competitor*. An Anthropic-curated
  masterclass featuring Stytch, Cloudflare, Arcade, Honeycomb, Langflow,
  and Stainless. Strategic signal: the agent-readiness ecosystem is being
  curated, and the open-scorecard slot is currently unclaimed.
]

#v(0.15in)

= What a14y is not chasing

#v(0.02in)
#text(size: 9.5pt, fill: text-muted)[
  Stated up front so the comparison stays bounded — these are deliberate
  non-goals, not gaps.
]
#v(0.06in)

#list(
  marker: text(fill: signal, weight: "bold")[›],
  spacing: 0.4em,
  body-indent: 0.3em,
  indent: 0pt,
  text(size: 9.5pt)[*Live OAuth + payment scoring* — ora.ai's territory; not a14y's audience.],
  text(size: 9.5pt)[*Hosted MCP server* — Cloudflare's funnel mechanism; a14y's audience runs the CLI in CI.],
  text(size: 9.5pt)[*Auth-for-agents infrastructure* — Stytch's territory. a14y scores the *presence* of agent-auth, vendor-agnostic.],
  text(size: 9.5pt)[*Remediation-as-a-service* — sitespeak.ai, StartDesigns. a14y's value is vendor-neutral measurement, not selling the fix.],
  text(size: 9.5pt)[*Repository scanning* — ambient-code/agentready owns that axis; a14y scans deployed sites.],
  text(size: 9.5pt)[*A paid backend* — open implementation is the moat.],
)

#v(0.18in)

// --- Contact card --------------------------------------------
#align(center)[
  #box(
    fill: surface-alt,
    inset: 10pt,
    radius: 6pt,
    stroke: 0.5pt + border-soft,
    width: 80%,
    [
      #text(size: 9pt, fill: text-muted, font: "Atkinson Hyperlegible Next")[
        For press inquiries, source data, or an updated revision:
      ]
      #v(3pt)
      #text(size: 11.5pt, weight: "bold", fill: brand-ink, font: "JetBrains Mono")[agentreadability\@gmail.com]
      #v(4pt)
      #text(size: 8pt, fill: text-subtle)[a14y.dev · github.com/timothyjordan/a14y]
    ]
  )
]
