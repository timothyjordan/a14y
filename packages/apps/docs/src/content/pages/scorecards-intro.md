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

### `flat-pool-v1` *(v0.2.0)*

The original algorithm:

```
score = round(100 × passed / applicable)
```

`applicable` is the flat pool of every check firing (site-wide checks
plus per-page checks across every page audited) that didn't return
`na`. Simple and intuitive at small scales, but site-wide signals get
diluted as page count grows: a 500-page audit pushes the site-wide
checks down to ~0.1% of the denominator, while a 1-page audit puts
them at ~40%. Different `--max-pages` settings produce different
effective weightings for the same site's site-wide signals.

### `per-check-mean-v1` *(v0.3.0-draft)*

Introduced in the v0.3.0-draft to fix the page-count dependence:

```
score = round(mean({ passed/applicable for each check_id where applicable > 0 }))
```

Each distinct check identity contributes one observation, regardless
of how many pages it fires on. Site-wide checks and per-page checks
sit on equal footing per check id; the cap a site is crawled at no
longer changes the weighting of its site-wide signals. For 1-page
audits the score is identical to `flat-pool-v1`; for site-mode audits
inflated cap-hit scores come down toward a more representative number
(e.g. posthog-docs 97 → 41 on a 500-page audit, where the 97 was
masking a long tail of failing per-page checks via high `na` rates).

The published draft contract for `per-check-mean-v1` ships before its
real implementation, per the docs-first 2-PR split documented in
[`CONTRIBUTING.md`](https://github.com/timothyjordan/a14y/blob/main/CONTRIBUTING.md#docs-first-for-scorecard-changes).
Until the impl PR lands, `v0.3.0-draft` scores are computed with the
`flat-pool-v1` formula as a placeholder, with the contract change
visible in the `scoringMethodology` field of every SiteRun.
