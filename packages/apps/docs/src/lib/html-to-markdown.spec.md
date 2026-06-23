# renderPageMarkdown

> Convert a full Astro-rendered HTML page into clean markdown body text. The
> returned string is the body only; the integration prepends frontmatter and
> appends the `## Sitemap` footer.

Takes a full HTML document string and returns the `<main>` content as clean
markdown. The mirror it produces is the source-of-truth representation an AI
agent reads instead of the rendered page, so structured content (definition
lists, tables, and verbatim preformatted blocks) must survive as faithful,
well-formed markdown rather than being flattened into an ambiguous run of text.

## Should

- Convert an HTML `<table>` into a GitHub-flavored markdown pipe table: a header
  row, a `| --- | ... |` separator row directly under it, then one row per
  `<tr>` in the body. Each cell is the text of its `<th>`/`<td>`, in document
  order. (Tables in these pages are the evidence of the page; flattening every
  cell onto its own line destroys the row/column relationship an agent needs.)
- Preserve inline emphasis inside table cells: a `<strong>`/`<b>` cell renders
  with `**bold**` markers and an inline `<code>` cell renders inside backticks.
- Escape any literal `|` character that appears inside a table cell's text so it
  cannot be mistaken for a column boundary.
- Convert an HTML definition list (`<dl>` containing `<dt>`/`<dd>` pairs) into one
  markdown line per pair of the form `**term** — definition`, where `term` is the
  `<dt>` text and `definition` is the `<dd>` content. (Turndown has no native
  `<dl>` rule, so without this the terms and definitions collapse into one
  mashed-together paragraph.)
- Preserve inline `<code>` and `<strong>` inside a `<dd>` as backticks / `**`
  in the rendered definition.
- Convert a bare `<pre class="study-pre">` (a preformatted block with no inner
  `<code>` element) into a fenced code block whose contents are the verbatim text
  of the block. The text is reproduced literally; it is NOT re-interpreted as
  markdown.
- Choose the code fence so it is strictly longer than the longest run of
  backticks contained in the block's text (and at least three backticks), so a
  block whose text itself contains a ``` sequence is not terminated early.
- Because a `study-pre` block is emitted as verbatim fenced code, any line inside
  it that begins with `#` (for example an AI agent's own markdown answer that
  contains `## Heading`) must NOT become a real markdown heading in the output:
  such lines stay inside the fence as literal text.
- Continue to return clean markdown with no leftover raw HTML tags
  (`<table>`, `<dl>`, `<dt>`, `<dd>`, `<pre>`, `<span>`, `<div>`) for these
  structures.

## Acceptance criteria

- A `<table>` with a `<thead>` header row `Metric | A | B` and a body row
  `Tokens | 1 | 2` renders containing the lines `| Metric | A | B |`,
  `| --- | --- | --- |`, and `| Tokens | 1 | 2 |`, in that order.
- A table cell containing `<code>npx a14y</code>` renders that cell as
  `` `npx a14y` `` inside the pipe row.
- A table cell whose text contains a literal `|` renders it escaped (`\|`) so the
  row still has the expected number of columns.
- A `<dl>` with `<div><dt>a14y score</dt><dd><strong>37</strong> → <strong>89</strong></dd></div>`
  renders a line matching `**a14y score** — **37** → **89**`.
- A `<pre class="study-pre">` whose text is the two lines `## Title` then `body`
  renders inside a fenced code block, and the output does not contain a real
  markdown heading line equal to `## Title` outside a fence (the `## Title` line
  is fenced literal text).
- A `<pre class="study-pre">` whose text itself contains a line of three
  backticks renders with an opening fence of four or more backticks, and the
  block's full text is preserved between the fences.
- The function does not throw for ordinary valid HTML input and does not mutate
  its argument.
</content>
