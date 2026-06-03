---
id: discovery.in-page-link
title: Agent files are linked in-page
group: Discoverability
scope: site
why: >
  Shipping an llms.txt, sitemap.md, or AGENTS.md is necessary but not sufficient. Handed a bare
  URL, an agent crawls the HTML it is given and may never probe for those files on its own. A
  visible "For agents" link block is what lets an agent discover the files at all. Treat this as a
  discoverability signal, not a promised token saving: the efficiency win is real only when the
  agent follows the link, which is not guaranteed on every run.
references:
  - title: "llms.txt proposal"
    url: https://llmstxt.org/
  - title: "AGENTS.md"
    url: https://agents.md/
---

> **Status: spec.** This check is pinned in the `0.3.0-draft` scorecard with a placeholder that returns N/A while the detector is implemented. The contract below is what it will assert once detection ships; it does not yet affect your score.

## How the check decides

The check runs once per site, after every page has been fetched. While each page's HTML is still parsed, it looks for an in-DOM `<a href>` that resolves to an agent-discovery file: `/llms.txt` (or `/llms-full.txt`), `/sitemap.md`, `/AGENTS.md`, or that page's own `.md` mirror. It then grades by *where* such a link lives:

- **Pass**: a top-level page carries an in-page link to at least one agent file. "Top-level" means the homepage (the site's root URL) or a first-level path such as `/docs`. An agent landing on either can find your files.
- **Warn**: no top-level page links to an agent file, but a deeper page (for example `/docs/agents`) does. An agent that lands at the top still can't find your files, but a crawler eventually will.
- **Fail**: no crawled page links to any agent file. The files, if they exist at all, are undiscoverable in-page.

Only links present in the served HTML count; a link injected by client-side JavaScript does not, because the agents this check is for do not run JS. In single-page mode there is no cross-page view to tell the homepage from a deep page, so the check returns N/A.

## How to implement it

Add a small, visible "For agents" block to your homepage (a footer section or header link group works well) that links the agent-discovery files you publish:

### Pass

```html
<!-- https://example.com/ (the homepage) -->
<footer>
  <nav aria-label="For agents">
    <a href="/llms.txt">llms.txt</a>
    <a href="/AGENTS.md">AGENTS.md</a>
    <a href="/sitemap.md">sitemap.md</a>
  </nav>
</footer>
```

The root page links the files, so an agent that lands there can find them.

### Fail

```html
<!-- https://example.com/ -->
<!-- /llms.txt and /AGENTS.md are published, but no page links to them -->
<footer>
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
</footer>
```

The files exist but nothing points to them, so an agent never requests them.
