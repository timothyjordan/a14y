# Baseline build

A deliberately un-enhanced variant of this docs site, built from the
same content as a14y.dev, used by [`@a14y/benchmark`](https://github.com/timothyjordan/a14y-internal) as the **"before"** in
before/after agent-readability case studies.

The baseline build looks identical to a14y.dev for humans (same layout,
typography, content, semantic HTML, alt text, ARIA), but the
agent-readability artifacts are stripped so it scores low on the a14y
scorecard. The benchmark then measures how much harder it is for a
coding agent to answer the same prompt against this site vs. the
enhanced one.

## What's different in the baseline build

Set via the build-time env flag `A14Y_BASELINE=1`:

- No `llms.txt`, `robots.txt`, `sitemap.xml`, `sitemap.md`, `AGENTS.md`,
  or `.well-known/agent-skills/**` are emitted (`discovery-files`
  integration skipped).
- No `.md` page mirrors (`markdown-mirrors` integration skipped).
- `<head>`: no `<link rel="canonical">`, no
  `<link rel="alternate" type="text/markdown">`, no
  `<link rel="agent-skills">`, no `<meta name="description">`, no
  `og:*`, no `twitter:*`, no inline JSON-LD.
- Footer: the "For agents" column is hidden.
- The embeddable badge widget's outbound `href="https://a14y.dev"` is
  swapped for `href="#"` so an agent crawling the baseline cannot
  fall through to the enhanced site.

The baseline intentionally has **no banner or copy disclosing that it
is a fixture**: any text mention of "a14y.dev" — even one that's not
a clickable link — could prompt a careful coding agent to `WebFetch`
the enhanced site and contaminate the before/after measurement. The
site looks exactly like the real product to a human visitor.

`<html lang="en">`, semantic HTML elements, `alt` text, and ARIA
attributes are kept — they serve assistive-tech users, not just
agents.

## Run it locally

```bash
# from the repo root
npm install
npm run build --workspace @a14y/core           # required dep of @a14y/docs

cd packages/apps/docs
npm run build:baseline                          # writes dist-baseline/
npm run preview:baseline                        # serves dist-baseline/ on :4322
```

The site is at <http://localhost:4322/>. Run the regular preview on
:4321 in another terminal if you want a side-by-side compare:

```bash
npm run build && npm run preview                # serves dist/ on :4321
```

## Run a benchmark against it

From the sibling [`a14y-internal`](https://github.com/timothyjordan/a14y-internal) repo
(the home of `@a14y/benchmark`):

```bash
a14y-benchmark spec.yaml --target http://localhost:4322/

# or, if the spec already has target: https://a14y.dev
a14y-benchmark spec.yaml --local 4322
```

Artifacts land under `.a14y/benchmarks/<spec-id>/<ISO-timestamp>.json`.
Run the same spec against `http://localhost:4321/` (or
`https://a14y.dev`) to get the "after" half of the comparison, then
diff with `--compare`.

## Reserved subdomain

`baseline.a14y.dev` is reserved for a possible future deploy of this
build (e.g. via Cloudflare Pages), so external researchers and CI can
target the baseline without standing up a local server. Not yet
deployed — local-only is sufficient for the benchmark tool.

## Score expectation

The enhanced site (a14y.dev) self-scores 92/100 on the v0.2.0
scorecard. The baseline build is expected to drop into the 40-50
range — the exact number is captured each PR via the verification
step in the implementing plan.
