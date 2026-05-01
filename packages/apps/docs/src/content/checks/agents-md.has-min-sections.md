---
id: agents-md.has-min-sections
title: agent skill file documents at least 2 of install/config/usage
group: Discoverability
scope: site
why: >
  An AGENTS.md that only has a project description is barely better than no file at all.
  Agents need actionable instructions, install, configure, use, to do anything useful
  with your project.
references:
  - title: "Agents.md spec"
    url: https://agents.md
---

## How the check decides

After locating the skill file, the check extracts every heading line and tests them against three regex families: installation (`install|getting started|quickstart`), configuration (`configuration|config|settings|options`), and usage (`usage|examples?|how to|reference|api`). Passes if at least 2 of the 3 families are present. Fails otherwise. Returns N/A if no skill file exists at all.

## How to implement it

Add at least two of an Installation section, a Configuration section, and a Usage / Examples section to your AGENTS.md (or CLAUDE.md, etc). The check looks at heading text, so the prose inside doesn't matter for passing, but real content matters for actually helping agents.

### Pass

```markdown
# Example Project

## Installation
Run `npm install example`.

## Usage
Import the default export and call `example()`.
```

### Fail

```markdown
# Example Project

A short description of what the project does.
```
