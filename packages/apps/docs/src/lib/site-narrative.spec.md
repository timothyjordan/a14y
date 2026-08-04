# buildSiteNarrative

> Turns one site's a14y scan result (`SiteRun`) into a short, neutral,
> plain-language summary, so every `/leaderboard/<slug>/` page carries unique,
> substantive prose instead of a templated score card.

Authored from intent (TJ-1430) before any test was written. The oracle is what
the summary is supposed to say about a run, not what the code happens to emit.

## Background

Google reported the per-site leaderboard pages as "Crawled - currently not
indexed": above the fold they were a score number plus templated lists, with no
unique text. `buildSiteNarrative(run, siteName)` produces two or three factual
sentences describing that specific site's result, drawn from its real data, so
each page has genuinely different prose.

## Signature

`buildSiteNarrative(run: SiteRun, siteName: string): string[]`

Returns an array of 2 or 3 sentences (never empty, never more than 3). A caller
joins them with a single space to form a paragraph.

## Should

- **Sentence 1 (always) states the score.** It contains `siteName`, the numeric
  `run.summary.score`, the phrase `out of 100`, and the scorecard version
  `run.scorecardVersion` (e.g. `v0.2.0`). The score and version are those of the
  passed-in run, verbatim.
- **Sentence 2 (always) states coverage and pass rate.**
  - When `run.pages.length === 1`, it says the scan checked a single page (not
    "1 pages").
  - When `run.pages.length > 1`, it states that page count.
  - When `run.pages.length === 0`, it says no pages were auditable and does NOT
    assert a pass percentage.
  - When at least one page exists, it includes a whole-number pass percentage
    computed as `round(100 * run.summary.passed / run.summary.applicable)`,
    followed by `%`. When `run.summary.applicable === 0` this percentage is 0
    rather than NaN or a divide-by-zero.
- **Sentence 3 (conditional) reports the core discovery surfaces.** The four
  surfaces, in order, are llms.txt (`llms-txt.exists`), AGENTS.md
  (`agents-md.exists`), an XML sitemap (`sitemap-xml.exists`), and a markdown
  sitemap (`sitemap-md.exists`).
  - A surface is "published" iff its `*.exists` site check has status `pass`.
  - Only surfaces whose `*.exists` check is actually present in
    `run.siteChecks` are mentioned; if a run evaluated none of the four (e.g. a
    page-mode check with no site checks), sentence 3 is omitted entirely and the
    result has length 2.
  - If every evaluated surface is published, the sentence lists the published
    surfaces and asserts nothing is absent.
  - If none are published, the sentence says the site publishes none of them and
    lists the absent surfaces.
  - Otherwise it lists the published surfaces and, separately, the absent ones,
    with grammatical agreement ("is absent" for one, "are absent" for more).
  - When the XML sitemap is published AND `sitemap-xml.valid` has status `pass`,
    it is described as "a valid XML sitemap"; otherwise "an XML sitemap". This
    distinction never applies to a surface that is absent.
- **Lists read naturally.** Two items join with "and"; three or more use commas
  with a final "and" (Oxford style). No trailing/leading commas, no empty list
  fragments.
- **Every sentence ends with a period** and contains no unresolved template
  artifacts (no `undefined`, `NaN`, `${`, or `[object Object]`).
- **The function is pure**: same run in, same sentences out; it does not mutate
  the run.

## Notes

- `SiteRun` has `summary.{score,passed,applicable}`, `scorecardVersion`,
  `pages` (array), and `siteChecks` (array of `{ id, status }`, where status is
  one of `pass | fail | warn | error | na`).
- Out of scope: HTML rendering, and whether search engines index the page.
- Tone is deliberately neutral: it states facts and does not editorialize about
  consequences.
