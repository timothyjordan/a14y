# Chrome Web Store listing

Copy Tim pastes into the developer dashboard when submitting a new version.
Keep this file in sync with the tagline used on a14y.dev.

---

## Privacy practices form (Developer Dashboard → Privacy practices)

### Data usage / categories

| Category | Answer | Notes |
|---|---|---|
| Personally identifiable info | No | |
| Health info | No | |
| Financial and payment info | No | |
| Authentication info | No | |
| Personal communications | No | |
| Location | No | |
| Web history | No | URLs you audit are not transmitted. |
| **User activity** | **Yes** | Anonymous interaction events (audit started/completed/error, install, settings changed) used to improve the extension. |
| Website content | No | The crawler fetches pages locally; content is never transmitted off-device. |

### Three Limited Use commitments — affirm all three:

1. I certify that the use of data is **consistent with my posted Privacy Policy**.
2. I certify that I do **not sell user data**.
3. I certify that I do **not use or transfer user data for purposes unrelated to the item's single purpose**.

### Privacy policy URL

`https://a14y.dev/privacy/`

### Remote code use

> **No.** This extension does not load or execute remote code. It sends anonymous interaction events to Google Analytics 4 via the Measurement Protocol HTTP API. Google's documented pattern for GA in Chrome extensions is at https://developer.chrome.com/docs/extensions/how-to/integrate/google-analytics.

---

## Name (≤45 chars)

```
a14y — Agent Readability
```

## Short name (for narrow UIs)

```
a14y
```

## Summary (≤132 chars)

```
Score how well any website is readable by AI agents — ChatGPT, Claude, Copilot, Cursor. Run the a14y scorecard from your browser.
```

*(127 chars)*

## Category

`Developer Tools`

## Language

`English (United States)`

## Detailed description

```markdown
a14y scores any web page — or an entire site — for how readable it is by
AI agents. When ChatGPT, Claude, Copilot, or Cursor fetch the web on a
user's behalf, most of what makes a page work for humans (layout chrome,
interactive widgets, client-side routing) actively gets in the way. The
a14y scorecard measures the signals that actually matter to an agent:
whether your content is discoverable, parseable, and comprehensible.

## What it does

Open the extension on any page and hit **Check this page** to run the
scorecard against that single URL, or **Scan whole site** to crawl from
the entry URL following same-origin links. In seconds you get a
0–100 score plus a per-check breakdown: which signals you're
nailing, which ones agents can't find, and a link to the fix guidance
for each failing check.

Every audit runs entirely in your browser. No server, no account, no
data collection — just the extension and the page you're auditing.

## What it measures

- **Discoverability** — robots.txt, sitemap, llms.txt, canonical
  links, redirect chains, HTTP 200 hygiene.
- **Parsing** — content-type headers, HTML lang attribute, meta
  description, OG tags, JSON-LD, Markdown alternate links, text ratio.
- **Comprehension** — headings, code-language tags, semantic
  structure, and a growing set of content-shape checks.

Each check is versioned in an open scorecard at a14y.dev — a pinned
v0.2.0 today — so scores from different runs stay comparable over time.

## Who it's for

- Docs teams shipping content that AI coding assistants retrieve and
  cite.
- Marketing and product pages whose biggest source of referrals is
  about to be agents, not search.
- Engineers debugging why their content shows up wrong in LLM answers.
- Anyone who wants to run the same open-source audit a14y.dev runs
  from the CLI, but without leaving the browser.

## Privacy

Every audit runs in your browser — the URLs you enter and the pages
the crawler fetches stay on your machine. a14y collects anonymous
usage data by default (audit started/completed events with bucketed
score and duration; never URLs, page content, or per-check details)
to help us improve the extension. You can turn it off in the
extension's options. Full policy: https://a14y.dev/privacy/

## Open source

Spec, scorecard, and tools live at
https://github.com/timothyjordan/a14y. The same scoring engine powers
the `a14y` CLI on npm and this extension — same URL + same scorecard
version = same score, every time.
```

## Website

`https://a14y.dev`

## Support email

`contact@a14y.dev`
