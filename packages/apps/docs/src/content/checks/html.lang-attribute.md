---
id: html.lang-attribute
title: Root <html> has lang attribute
group: HTML metadata
scope: page
why: >
  The lang attribute on `<html>` is the universal "what language is this page in"
  declaration. Agents use it for content routing, translation, and tokenization heuristics.
  Without it they have to guess from the body, and they often guess wrong on technical docs.
references:
  - title: "HTML spec: lang attribute"
    url: https://html.spec.whatwg.org/multipage/dom.html#the-lang-and-xml:lang-attributes
---

## How the check decides

The check reads the `lang` attribute on the root `<html>` element and asserts it is present and non-empty. Fails if it's missing.

## How to implement it

Set `lang` on your `<html>` tag, or in the layout component your framework uses for the document shell. Use a BCP-47 tag like `en`, `en-US`, `de`, `ja`, etc.

### Pass

```html
<!doctype html>
<html lang="en">
  ...
</html>
```

### Fail

```html
<!doctype html>
<html>
  ...
</html>
```

## Common gotchas

Use the language code that matches the **document's actual content**, not the user's locale. If you serve English docs to a Japanese visitor, `lang="en"` is correct — the visitor's browser-language is irrelevant to what's on the page.

For multilingual sites, set `lang` on each `<html>` element to the page's language and use `<link rel="alternate" hreflang="...">` to advertise translations. This is standard SEO practice and agents follow it cleanly.

The valid format is BCP-47 — `en`, `en-US`, `en-GB`, `de`, `de-CH`, `pt-BR`, `zh-Hans`, etc. Don't use `english` or `EN_US` (the underscore form is locale-data syntax, not BCP-47). Most browsers and crawlers tolerate the wrong shape but the check is strict because agents downstream of the check usually aren't.
