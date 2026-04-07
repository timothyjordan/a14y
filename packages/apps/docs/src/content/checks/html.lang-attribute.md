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
