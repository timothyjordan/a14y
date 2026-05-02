---
title: Scorecards · a14y
description: Every shipped a14y scorecard. Frozen, versioned manifests of pass-or-fail checks that operationalize the agent-readability spec.
---

## How scorecards work

A scorecard is a frozen manifest pinning each stable check id to an
implementation version. Once shipped, a scorecard never changes: when
a check's behaviour evolves, a new scorecard is published that points
at the new implementation version while older scorecards keep pointing
at the old one.

This means historical audits stay reproducible: if you measured your
site against v0.2.0 last month, re-running v0.2.0 today gives the same
score even after the engine ships new check versions.
