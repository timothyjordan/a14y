---
id: robots-txt.allows-llms-txt
title: robots.txt does not disallow llms.txt
group: Discoverability
scope: site
why: >
  Publishing llms.txt and then disallowing it in robots.txt is a contradiction that confuses
  every well-behaved agent. This check catches the rare but visible case where the two files
  are out of sync.
references:
  - title: "llmstxt.org spec"
    url: https://llmstxt.org
---

## How the check decides

The check parses robots.txt and asks the universal user-agent `*` whether `/llms.txt` and `/.well-known/llms.txt` are allowed. Passes if both are reachable. Fails with the offending paths if either is disallowed. If no robots.txt exists the check passes (allow-all by default).

robots.txt is fetched from the scanned site, following redirects. Its rules apply to the host you scanned, even when `/robots.txt` redirects to another host (for example `example.com` → `www.example.com`), the same way [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309#section-2.3.1.2) tells crawlers to treat a redirected robots.txt.

## How to implement it

If you've added a global `Disallow: /` for any user-agent, add an explicit `Allow: /llms.txt` line above it for the same user-agent. Or just don't disallow llms.txt in the first place.

### Pass

```text
User-agent: *
Allow: /
```

```text
# A robots.txt with only comments and no rules allows everything.
```

### Fail

```text
User-agent: *
Disallow: /llms.txt
```
