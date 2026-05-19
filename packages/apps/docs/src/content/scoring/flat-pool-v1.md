---
id: flat-pool-v1
title: "flat-pool-v1 · scoring methodology"
description: "The original a14y scorecard scoring algorithm, pinned by v0.2.0."
appliesTo:
  - "0.2.0"
---

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
