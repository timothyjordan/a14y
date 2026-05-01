---
id: robots-txt.allows-ai-bots
title: robots.txt allows AI bots
group: Discoverability
scope: site
why: >
  GPTBot, ClaudeBot, CCBot, and Google-Extended are the named user-agents that today's
  largest AI ingesters use. Disallowing them in robots.txt is the explicit "do not include
  this site in any LLM" signal, and it's almost always set inadvertently when authors
  copy-paste a generic robots.txt template.
references:
  - title: "OpenAI: GPTBot"
    url: https://platform.openai.com/docs/gptbot
  - title: "Anthropic: ClaudeBot"
    url: https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web
  - title: "Google: Google-Extended"
    url: https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
  - title: "Common Crawl: CCBot"
    url: https://commoncrawl.org/ccbot
---

## How the check decides

The check parses your robots.txt with [`robots-parser`](https://github.com/samclarke/robots-parser) and asks each of `GPTBot`, `ClaudeBot`, `CCBot`, and `Google-Extended` whether the site root (`/`) is allowed. Passes if all four are allowed. Fails (with a list of blocked bots) if any are disallowed. If no robots.txt exists at all, the check passes, no robots.txt implies allow-all.

## How to implement it

Either omit named AI bot user-agents entirely (the global `User-agent: *` rule applies) or add explicit allow rules for them. Don't add `User-agent: GPTBot\nDisallow: /` unless you've decided you actively don't want to be in a corpus.

### Pass

```text
User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml
```

### Fail

```text
User-agent: *
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /
```
