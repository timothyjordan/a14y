---
title: a14y · agent readability for the web
description: Agent readability for the web. An open spec, a versioned scorecard, and the tools (CLI plus Chrome extension) that score any website for how well AI agents can discover, parse, and comprehend it.
---

<hr class="section-rule" aria-hidden="true" />

<section class="section section--tight" aria-label="What a14y offers">
<div class="section-head">
<h2>Three pillars</h2>
<p class="section-sub">
The spec defines what agent-readable means. The scorecard turns
it into pass-or-fail checks. The tools run those checks against
any URL.
</p>
</div>
<div class="pillars">
<a class="pillar-card pillar-card--external" href="/spec/">
<span class="pillar-label">Pillar 01 · open</span>
<span class="pillar-title">The spec</span>
<span class="pillar-desc">
Three layers (discoverability, parsing, comprehension) that
any site can implement to become readable to AI agents.
</span>
<span class="pillar-link">Read the spec</span>
</a>
<a class="pillar-card pillar-card--external" href="/scorecards/{{LATEST_VERSION}}/">
<span class="pillar-label">Pillar 02 · versioned</span>
<span class="pillar-title">The scorecard</span>
<span class="pillar-desc">
v{{LATEST_VERSION}} pins {{TOTAL_CHECKS}} checks ({{SITE_CHECK_COUNT}} site-level,
{{PAGE_CHECK_COUNT}} page-level). Each check links to its detection
mechanics and fix guidance.
</span>
<span class="pillar-link">Browse v{{LATEST_VERSION}}</span>
</a>
<a class="pillar-card pillar-card--internal" href="#tools">
<span class="pillar-label">Pillar 03 · runnable</span>
<span class="pillar-title">The tools</span>
<span class="pillar-desc">
A CLI and a Chrome extension that run the scorecard against
any URL. Output a human report, JSON, or a fix-list a coding
agent can ship straight into a PR.
</span>
<span class="pillar-link">See the tools</span>
</a>
</div>
</section>

<section id="tools" class="section" aria-labelledby="tools-heading">
<div class="section-head">
<h2 id="tools-heading">Run the scorecard yourself</h2>
<p class="section-sub">
Same engine, two surfaces. Both produce the same score for the
same URL and scorecard version.
</p>
</div>
<div class="tools">
<article class="tool-card">
<div class="tool-head">
<span class="tool-badge" aria-hidden="true">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<polyline points="4 17 10 11 4 5" />
<line x1="12" y1="19" x2="20" y2="19" />
</svg>
</span>
<h3>CLI</h3>
</div>
<p class="tool-desc">
Audit any page or whole site from your terminal. Outputs a
scored text report, JSON, or a Markdown fix-list ready to
hand to a coding agent.
</p>
<pre class="tool-cmd"><code><span class="prompt">%</span> npm install -g a14y
<span class="prompt">%</span> a14y your-site.com</code></pre>
<div class="tool-actions">
<a class="btn btn--primary" href="https://www.npmjs.com/package/a14y" rel="noopener">Install from npm →</a>
<a class="btn btn--ghost" href="https://github.com/timothyjordan/a14y" rel="noopener">GitHub →</a>
</div>
</article>
<article class="tool-card">
<div class="tool-head">
<span class="tool-badge" aria-hidden="true">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<circle cx="12" cy="12" r="9" />
<path d="M12 3a9 9 0 0 1 7.8 4.5H12" />
<path d="M3.5 8.5 7.5 15" />
<circle cx="12" cy="12" r="3" />
</svg>
</span>
<h3>Chrome Extension</h3>
</div>
<p class="tool-desc">
Score any page you are looking at, right in the browser.
Switch scorecard versions from the popup, jump straight to
the failing check's fix guidance.
</p>
<div class="tool-actions">
<span class="btn btn--primary btn--disabled" aria-disabled="true" role="link">
Chrome Web Store
</span>
<a class="btn btn--ghost" href="https://github.com/timothyjordan/a14y/tree/main/packages/apps/extension" rel="noopener">View source →</a>
</div>
<p class="tool-note">Coming soon to the Chrome Web Store. For now, load the unpacked build from GitHub.</p>
</article>
</div>
</section>

<section class="section" aria-labelledby="how-heading">
<div class="section-head">
<h2 id="how-heading">Hand the fixes to a coding agent</h2>
<p class="section-sub">
Run with <code>--output agent-prompt</code> and you get a
Markdown brief any coding agent can consume directly. Every
failure carries the detection rule, the fix, and a link back
to the scorecard page.
</p>
</div>
<div class="output-sample">
<div class="output-sample-prose">
<h3>An end-to-end loop</h3>
<p>
<code>a14y your-site.com --output agent-prompt</code> writes
a fix-list to stdout (or pipe it to a file). Drop it into
your coding agent of choice. Re-run with
<code>--fail-under 80</code> in CI to keep the score climbing.
</p>
<p>
Every scorecard version stays frozen forever, so historical
scores trend cleanly even as the engine evolves.
</p>
<p>
The block on the right is real output from
<code>a14y https://a14y.dev --output agent-prompt</code>.
The site is its own first benchmark.
</p>
</div>
<pre class="output-sample-block" aria-label="Real agent-prompt output for a14y.dev"><span class="ag-prompt">%</span> a14y https://a14y.dev --output agent-prompt
<span class="heading"># Agent readability fix-list — https://a14y.dev/</span>

You are an autonomous coding agent. The a14y scorecard
ran against https://a14y.dev/ on 2026-04-30 and identified
<strong>3</strong> distinct failing checks across <strong>1</strong> page. Score: <strong>92/100</strong>.

After applying fixes, re-run the audit to verify:

  <em>a14y check https://a14y.dev/ --mode page</em>

<span class="heading">## Snapshot</span>

- <em>Score:</em>      92/100
- <em>Mode:</em>       page
- <em>Scorecard:</em>  v{{LATEST_VERSION}} (released {{RELEASED_AT}})
- <em>Failed:</em>     3 (3 unique, 3 instances)
- <em>Passed:</em>     33     <em>N/A:</em> 2

<span class="heading">## Failing checks</span>

<span class="heading">### 1. code.language-tags — 1 page</span>
- <em>What it checks:</em> code blocks declare a language
- <em>Sample message:</em> 1/1 blocks missing language
- <em>Docs:</em> https://a14y.dev/scorecards/{{LATEST_VERSION}}/checks/code.language-tags/

<span class="heading">### 2. markdown.canonical-header — 1 page</span>
- <em>Sample:</em> no Link header
- <em>Docs:</em> https://a14y.dev/scorecards/{{LATEST_VERSION}}/checks/markdown.canonical-header/

<span class="heading">### 3. markdown.content-negotiation — 1 page</span>
- <em>Sample:</em> text/html; charset=utf-8</pre>
</div>
</section>
