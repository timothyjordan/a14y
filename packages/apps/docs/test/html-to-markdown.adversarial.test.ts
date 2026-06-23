/*
 * CLEAN-ROOM ADVERSARIAL TEST SUITE for renderPageMarkdown.
 *
 * The test oracle below is derived SOLELY from the behavioral spec and the
 * type façade provided for this unit. The implementation in
 * `src/lib/html-to-markdown.ts` was NOT read, opened, grepped, or inferred.
 * Every expected literal is justified by a specific spec bullet / acceptance
 * criterion, not by what the code happens to do.
 *
 * Façade under test:
 *   renderPageMarkdown(html: string, _opts?: HtmlToMarkdownOptions): string
 *   "Convert a full Astro-rendered HTML page into clean markdown body text.
 *    The returned string is the body only." It operates on the page's <main>
 *    element, so every fixture wraps content in <main class="container">.
 */

import { describe, it, expect } from 'vitest';
import { renderPageMarkdown } from '../src/lib/html-to-markdown';

/** Wrap fixture content inside <main class="container"> per the façade JSDoc. */
function page(inner: string): string {
  return `<html><body><main class="container">${inner}</main></body></html>`;
}

/**
 * Find fenced-code regions in markdown output. A fence is a line consisting
 * only of >=3 backticks. Returns array of [startLineIdx, endLineIdx] pairs
 * (inclusive of the fence lines). Used to assert content sits inside a fence.
 */
function fenceRegions(md: string): Array<[number, number]> {
  const lines = md.split('\n');
  const regions: Array<[number, number]> = [];
  let open: number | null = null;
  let openFence = '';
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const isFence = /^`{3,}/.test(trimmed) && /^`+$/.test(trimmed.replace(/^(`+).*$/, '$1'));
    const fenceMatch = trimmed.match(/^(`{3,})\s*[^`]*$/);
    if (open === null) {
      if (fenceMatch) {
        open = i;
        openFence = fenceMatch[1];
      }
    } else {
      // close on a line that is only backticks of >= the opening length
      if (/^`{3,}$/.test(trimmed) && trimmed.length >= openFence.length) {
        regions.push([open, i]);
        open = null;
        openFence = '';
      }
    }
    void isFence;
  }
  return regions;
}

function lineIndexOf(md: string, exactLine: string): number {
  return md.split('\n').findIndex((l) => l === exactLine);
}

function isLineInsideFence(md: string, lineIdx: number): boolean {
  if (lineIdx < 0) return false;
  return fenceRegions(md).some(([s, e]) => lineIdx > s && lineIdx < e);
}

describe('renderPageMarkdown — tables', () => {
  it('renders a thead/tbody table as a GFM pipe table with header, separator, and body rows in order', () => {
    const html = page(`
      <table>
        <thead><tr><th>Metric</th><th>A</th><th>B</th></tr></thead>
        <tbody><tr><td>Tokens</td><td>1</td><td>2</td></tr></tbody>
      </table>
    `);
    const md = renderPageMarkdown(html);

    // Acceptance criterion: contains these three lines, in this order.
    expect(md).toContain('| Metric | A | B |');
    expect(md).toContain('| --- | --- | --- |');
    expect(md).toContain('| Tokens | 1 | 2 |');

    const lines = md.split('\n');
    const headerIdx = lines.indexOf('| Metric | A | B |');
    const sepIdx = lines.indexOf('| --- | --- | --- |');
    const bodyIdx = lines.indexOf('| Tokens | 1 | 2 |');
    expect(headerIdx).toBeGreaterThanOrEqual(0);
    expect(sepIdx).toBe(headerIdx + 1); // separator directly under the header
    expect(bodyIdx).toBeGreaterThan(sepIdx);

    // No raw table tags leak.
    expect(md).not.toMatch(/<\/?table>/i);
    expect(md).not.toMatch(/<\/?t[hdr]>/i);
    expect(md).not.toMatch(/<\/?thead>|<\/?tbody>/i);
  });

  it('renders an inline <code> cell wrapped in backticks inside the pipe row', () => {
    const html = page(`
      <table>
        <thead><tr><th>Command</th></tr></thead>
        <tbody><tr><td><code>npx a14y</code></td></tr></tbody>
      </table>
    `);
    const md = renderPageMarkdown(html);
    // Acceptance: the cell renders as `npx a14y` inside a pipe row.
    expect(md).toContain('| `npx a14y` |');
    expect(md).not.toMatch(/<\/?code>/i);
  });

  it('renders a <strong>/<b> cell as **bold** inside the pipe row', () => {
    const html = page(`
      <table>
        <thead><tr><th>Result</th></tr></thead>
        <tbody><tr><td><strong>37</strong></td></tr></tbody>
      </table>
    `);
    const md = renderPageMarkdown(html);
    // "Should": a <strong>/<b> cell renders with **bold**.
    expect(md).toContain('| **37** |');
    expect(md).not.toMatch(/<\/?strong>/i);
  });

  it('escapes a literal | inside a cell so it is not treated as a column boundary', () => {
    const html = page(`
      <table>
        <thead><tr><th>Expr</th></tr></thead>
        <tbody><tr><td>a | b</td></tr></tbody>
      </table>
    `);
    const md = renderPageMarkdown(html);
    // Acceptance: a literal | in cell text renders escaped as \|.
    expect(md).toContain('a \\| b');
    // The body row must keep exactly two real column boundaries (one leading,
    // one trailing) plus the escaped pipe, i.e. it must contain `| a \| b |`.
    expect(md).toContain('| a \\| b |');
  });
});

describe('renderPageMarkdown — definition lists', () => {
  it('renders dt/dd pairs (wrapped in <div>) as "**term** — definition" with an em-dash', () => {
    const html = page(`
      <dl>
        <div><dt>a14y score</dt><dd><strong>37</strong> → <strong>89</strong></dd></div>
      </dl>
    `);
    const md = renderPageMarkdown(html);
    // Acceptance: renders a line matching `**a14y score** — **37** → **89**`.
    // The dash is U+2014 with a space on each side.
    expect(md).toContain('**a14y score** — **37** → **89**');
    // Confirm the actual em-dash character is used (U+2014), not a hyphen.
    expect(md).toMatch(/\*\*a14y score\*\* — /);
  });

  it('preserves inline <code> inside a <dd> as backticks', () => {
    const html = page(`
      <dl>
        <div><dt>install</dt><dd>run <code>npx a14y</code> now</dd></div>
      </dl>
    `);
    const md = renderPageMarkdown(html);
    expect(md).toContain('**install** — ');
    expect(md).toContain('`npx a14y`');
    expect(md).not.toMatch(/<\/?code>/i);
  });

  it('preserves inline <strong> inside a <dd> as **', () => {
    const html = page(`
      <dl>
        <div><dt>delta</dt><dd>improved by <strong>52</strong> points</dd></div>
      </dl>
    `);
    const md = renderPageMarkdown(html);
    expect(md).toContain('**delta** — ');
    expect(md).toContain('**52**');
  });

  it('renders one line per dt/dd pair', () => {
    const html = page(`
      <dl>
        <div><dt>one</dt><dd>first</dd></div>
        <div><dt>two</dt><dd>second</dd></div>
      </dl>
    `);
    const md = renderPageMarkdown(html);
    expect(md).toContain('**one** — first');
    expect(md).toContain('**two** — second');
    // Each pair is its own line.
    const lines = md.split('\n');
    expect(lines.some((l) => l.trim() === '**one** — first')).toBe(true);
    expect(lines.some((l) => l.trim() === '**two** — second')).toBe(true);
    // No raw dl/dt/dd tags leak.
    expect(md).not.toMatch(/<\/?dl>|<\/?dt>|<\/?dd>/i);
  });
});

describe('renderPageMarkdown — study-pre fenced code', () => {
  it('emits a bare <pre class="study-pre"> as a fenced code block', () => {
    const html = page(`<pre class="study-pre">line one
line two</pre>`);
    const md = renderPageMarkdown(html);
    // Must be fenced; the verbatim text must survive.
    const regions = fenceRegions(md);
    expect(regions.length).toBeGreaterThanOrEqual(1);
    expect(md).toContain('line one');
    expect(md).toContain('line two');
    expect(md).not.toMatch(/<\/?pre>/i);
  });

  it('does NOT turn a "## Title" line inside study-pre into a real markdown heading', () => {
    const html = page(`<pre class="study-pre">## Title
body</pre>`);
    const md = renderPageMarkdown(html);

    // Acceptance: the ## Title text still appears, but it is enclosed by a fence
    // (so it is not a real heading line outside a fence).
    const titleIdx = lineIndexOf(md, '## Title');
    expect(titleIdx).toBeGreaterThanOrEqual(0);
    expect(isLineInsideFence(md, titleIdx)).toBe(true);

    // There must be NO line exactly "## Title" that sits outside any fence.
    const lines = md.split('\n');
    const headingLeaks = lines
      .map((l, i) => (l === '## Title' ? i : -1))
      .filter((i) => i >= 0)
      .filter((i) => !isLineInsideFence(md, i));
    expect(headingLeaks).toEqual([]);
  });

  it('reproduces study-pre text verbatim (not re-interpreted as markdown)', () => {
    // Markdown-significant characters that must NOT be transformed.
    const html = page(`<pre class="study-pre">- not a list item
**not bold**
[not a link](x)</pre>`);
    const md = renderPageMarkdown(html);
    expect(md).toContain('- not a list item');
    expect(md).toContain('**not bold**');
    expect(md).toContain('[not a link](x)');
    // The literal text sits inside a fence.
    const idx = lineIndexOf(md, '**not bold**');
    expect(isLineInsideFence(md, idx)).toBe(true);
  });

  it('uses an opening fence of >= 4 backticks when the text contains a ``` line, preserving the literal backticks', () => {
    const inner = 'before\n```\nafter';
    const html = page(`<pre class="study-pre">${inner}</pre>`);
    const md = renderPageMarkdown(html);

    // Acceptance: opening fence is four or more backticks.
    const lines = md.split('\n');
    const openingFence = lines.find((l) => /^`{3,}/.test(l.trim()));
    expect(openingFence).toBeDefined();
    const fenceTicks = (openingFence as string).trim().match(/^(`+)/)?.[1] ?? '';
    expect(fenceTicks.length).toBeGreaterThanOrEqual(4);

    // The block's full text (including the literal ``` line) is preserved.
    expect(md).toContain('before');
    expect(md).toContain('after');
    expect(md).toContain('```');

    // The verbatim ``` line is between the (longer) fences, not terminating early:
    // the literal three-backtick line is shorter than the opening fence, so it
    // must still be present alongside both before/after content.
    const idxBefore = md.indexOf('before');
    const idxAfter = md.indexOf('after');
    expect(idxBefore).toBeGreaterThanOrEqual(0);
    expect(idxAfter).toBeGreaterThan(idxBefore);
  });

  it('chooses a fence strictly longer than the longest backtick run (>=4 ticks for a run of 3)', () => {
    const html = page(`<pre class="study-pre">x \`\`\` y</pre>`);
    const md = renderPageMarkdown(html);
    const lines = md.split('\n');
    const fenceLine = lines.find((l) => /^`{3,}/.test(l.trim()));
    expect(fenceLine).toBeDefined();
    const ticks = (fenceLine as string).trim().match(/^(`+)/)?.[1] ?? '';
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(md).toContain('x ``` y');
  });
});

describe('renderPageMarkdown — no leftover raw HTML', () => {
  it('does not leave raw structural tags for tables, dls, pres, spans, or divs', () => {
    const html = page(`
      <table>
        <thead><tr><th>H</th></tr></thead>
        <tbody><tr><td><span>v</span></td></tr></tbody>
      </table>
      <dl>
        <div><dt>t</dt><dd>d</dd></div>
      </dl>
      <pre class="study-pre">code</pre>
    `);
    const md = renderPageMarkdown(html);
    for (const tag of ['table', 'dl', 'dt', 'dd', 'pre', 'span', 'div', 'thead', 'tbody', 'tr', 'th', 'td']) {
      expect(md).not.toMatch(new RegExp(`<\\/?${tag}(\\s|>|/)`, 'i'));
    }
  });
});

describe('renderPageMarkdown — robustness & no mutation', () => {
  it('does not throw for ordinary valid HTML input', () => {
    const html = page(`
      <table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>
      <dl><div><dt>x</dt><dd>y</dd></div></dl>
      <pre class="study-pre">z</pre>
    `);
    expect(() => renderPageMarkdown(html)).not.toThrow();
  });

  it('does not throw for an empty <main>', () => {
    expect(() => renderPageMarkdown(page(''))).not.toThrow();
    expect(typeof renderPageMarkdown(page(''))).toBe('string');
  });

  it('does not mutate its argument and is deterministic across calls', () => {
    const html = page(`
      <table><thead><tr><th>Metric</th><th>A</th></tr></thead><tbody><tr><td>Tokens</td><td>1</td></tr></tbody></table>
      <dl><div><dt>a14y score</dt><dd><strong>37</strong> → <strong>89</strong></dd></div></dl>
      <pre class="study-pre">## Title
body</pre>
    `);
    const snapshot = html;
    const first = renderPageMarkdown(html);
    // Argument string is unchanged (strings are immutable; verify the variable).
    expect(html).toBe(snapshot);
    // Determinism: a second call yields identical output.
    const second = renderPageMarkdown(html);
    expect(second).toBe(first);
  });

  it('returns a string (body only)', () => {
    const out = renderPageMarkdown(page('<dl><div><dt>k</dt><dd>v</dd></div></dl>'));
    expect(typeof out).toBe('string');
  });
});
