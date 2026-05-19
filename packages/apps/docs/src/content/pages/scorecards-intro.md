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

## Scoring methodology

The scoring algorithm — how each check's pass/fail/na status turns
into a single 0–100 number — is part of every scorecard's contract.
Scorecards pin a `scoringMethodology` alongside their check set so
the algorithm can evolve without retroactively changing the scores
of older scorecards. A consumer pinned to `v0.2.0` keeps getting the
v0.2.0 algorithm forever, even after later scorecards adopt newer ones.

Every known algorithm is documented under [Scoring methodologies](/scorecards/scoring/).
Methodology changes between scorecard versions are recorded on each draft's
changes page like any other contribution.
