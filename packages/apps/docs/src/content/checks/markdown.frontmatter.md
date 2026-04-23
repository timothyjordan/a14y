---
id: markdown.frontmatter
title: Markdown mirror has required frontmatter
group: Markdown mirror
scope: page
why: >
  Frontmatter on the markdown mirror is metadata that doesn't have to be parsed out of
  the body. Agents read the title, description, doc_version, and last_updated fields to
  index, deduplicate, and trend the page over time.
references:
  - title: "Frontmatter"
    url: https://jekyllrb.com/docs/front-matter/
---

## How the check decides

The check fetches the markdown mirror, parses its YAML frontmatter with [gray-matter](https://github.com/jonschlinkert/gray-matter), and asserts every one of `title`, `description`, `doc_version`, and `last_updated` is present. Fails (with the missing keys) if any are absent. Returns N/A if no mirror was published at all.

## How to implement it

When you generate the markdown mirror, include a YAML frontmatter block at the top with the four required keys. Most SSGs already have a `title` and `description` for each page; `doc_version` is the docs/product version this page documents and `last_updated` is the source-file mtime in ISO 8601.

### Pass

```markdown
---
title: Install a14y
description: Install a14y in under a minute and audit your first site.
doc_version: "0.2"
last_updated: 2026-04-01
---

# Install a14y
...
```

### Fail

```markdown
---
title: Install a14y
---

# Install a14y
...
```
