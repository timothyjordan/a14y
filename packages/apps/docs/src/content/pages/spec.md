---
title: The Agent Readability spec · a14y
description: An open spec for making any website readable to AI agents. Three layers (discoverability, parsing, comprehension) plus the versioned scorecard that operationalizes them.
---

## What it is

**Agent readability** is the property of a website that lets AI
agents (assistants like ChatGPT, Claude, Copilot, and Cursor, plus
autonomous agents built on top of them) find its pages, fetch their content
without wasting tokens on layout chrome, and extract the facts, code, and
context a user actually asked for. The goal isn't to turn every page into
markdown or build a separate "AI version" of your site. It's to expose the
signals agents need alongside the page you already serve to humans.

## Why it matters

Discovery is shifting. For a growing share of users, the first answer about a
product, a help-center question, or a technical topic comes through an AI
agent, not a search engine, and often not the linked site at all. When an
agent is the reader, three things change. Tokens cost money, so scraping a
5 MB HTML document to surface two paragraphs is wasteful. Layout and
navigation chrome dominates raw HTML by byte count, so agents can miss the
content signal altogether and hallucinate from training data. And because
agents rarely cite their sources by URL, a site that is opaque to them
quietly disappears from conversation.

Agent readability is to AI-mediated discovery what SEO was to search:
cheap to implement, compounding in return, and increasingly table stakes.
It applies to any website that wants to be read by an agent. Documentation
portals and developer references are a common, high-value target, but
product pages, marketing sites, help centers, and long-form content all
benefit from the same practices.

<h2>The three layers</h2>
<p class="lead">
  Every check in the scorecard maps to one of these layers. They build on
  each other: a page agents cannot find never gets parsed, and a page
  parsed into garbage never gets comprehended.
</p>

<div class="spec-layers">
  <article class="spec-layer">
    <div class="layer-num">Layer 01</div>
    <h3>Discoverability</h3>
    <p>
      Can agents find every page you want them to read? Covers
      <code>llms.txt</code>, <code>robots.txt</code> (with AI bots allowed),
      XML and markdown sitemaps, and <code>AGENTS.md</code> skill files.
      Orphaned pages, absent sitemaps, and AI-excluding robots rules all
      make a site invisible to agents by default.
    </p>
  </article>
  <article class="spec-layer">
    <div class="layer-num">Layer 02</div>
    <h3>Parsing</h3>
    <p>
      Once an agent fetches a page, can it extract the content efficiently?
      Covers HTTP basics (no redirect chains, correct content types), HTML
      metadata (canonical link, lang, OG, meta description), markdown
      mirrors (<code>.md</code> at the same URL with frontmatter), and
      content-to-chrome ratio. The cheapest win is usually a mirror: one
      <code>.md</code> file per page, served with the right content type.
    </p>
  </article>
  <article class="spec-layer">
    <div class="layer-num">Layer 03</div>
    <h3>Comprehension</h3>
    <p>
      Once parsed, does the content self-describe? Covers structured data
      (JSON-LD with <code>dateModified</code> and <code>BreadcrumbList</code>),
      language-tagged code blocks, API schema links, and semantic heading
      hierarchy. These are the signals an agent uses to generate
      accurate citations, working code examples, and cross-references
      that don't hallucinate.
    </p>
  </article>
</div>

## How the scorecard operationalizes it

The [a14y scorecard](/scorecards/{{LATEST_VERSION}}/) is a
versioned, frozen manifest of pass-or-fail checks that maps directly to the
three layers above. Each check has a stable id, a documented detection
rule, pass and fail examples, and fix guidance, so a failing result is an
immediately actionable work item, not a vague "improve your SEO" nudge.
Scorecards are frozen once shipped: v{{LATEST_VERSION}} always evaluates the same
way, so historical scores compare cleanly even as the engine evolves.

Pinning a scorecard version lets teams track trend over time and gate
merges in CI (`--fail-under 80`) without every engine
improvement resetting the baseline.

## Status

The spec is open and evolving. v{{LATEST_VERSION}} is the current scorecard. See
the [check list](/scorecards/{{LATEST_VERSION}}/) for exactly
what it measures today. New scorecard versions publish additively: older
versions stay supported so your existing audits keep reproducing.
Contributions, issues, and proposed new checks live on
[GitHub](https://github.com/timothyjordan/a14y).
