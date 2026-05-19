---
id: per-check-mean-v1
title: "per-check-mean-v1 · scoring methodology"
description: "Per-check-identity mean, introduced in v0.3.0-draft to fix flat-pool's page-count dependence."
appliesTo:
  - "0.3.0-draft"
---

Introduced in the v0.3.0-draft to fix the page-count dependence in
[`flat-pool-v1`](/scorecards/scoring/flat-pool-v1/):

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
