---
id: markdown.navigation-stripped
title: Markdown mirror has navigation chrome stripped
group: Markdown mirror
scope: page
why: >
  The point of a markdown mirror is to give agents only the page content, with no
  nav, header, footer, or sidebar boilerplate. If the mirror is just an HTML→markdown
  dump that kept the chrome, agents pay token cost for content they did not ask for
  and have to re-extract the article anyway.
---

## How the check decides

The check fetches the markdown mirror and counts literal `<nav>`, `<header>`, `<footer>`, and `<aside>` tags in the body. Passes if zero. Fails with the count if any are present. Returns N/A if no mirror was published at all.

## How to implement it

Generate the markdown mirror from the article body only — strip the layout shell (nav/header/footer/sidebar) before serialising. Most SSGs that expose markdown directly already do this; HTML-to-markdown converters typically do not, so a generator script that round-trips the rendered HTML will need an explicit stripping step.

### Pass

```markdown
# Install a14y

Run `npm install -g @a14y/cli` and then `a14y https://example.com` to audit a site.
```

### Fail

```markdown
<nav>Home / Docs / API</nav>

# Install a14y

Run `npm install -g @a14y/cli` ...

<footer>© 2026</footer>
```
