import { describe, it, expect } from 'vitest';
import { renderPageMarkdown } from '../src/lib/html-to-markdown';

/*
 * Property-based tests for `renderPageMarkdown(html: string): string`.
 *
 * Oracle: derived clean-room from the behavioral spec ONLY. The implementation
 * source (`src/lib/html-to-markdown.ts`) was deliberately never read; every
 * assertion below encodes a rule stated in the spec, not observed behavior.
 *
 * fast-check is NOT installed in this project, so a small SEEDED inline PRNG
 * (mulberry32) drives reproducible generative inputs. Each property runs over
 * many seeded iterations; failures are reproducible by re-deriving from the
 * fixed base seed and the iteration index.
 *
 * Spec facts encoded:
 *  - A <table> -> GFM pipe table: header row, a separator row of exactly N
 *    `---` cells directly under it, then one body row per <tr>.
 *  - Literal `|` in cell text is escaped as `\|` (never adds a column).
 *  - A <dl> of <div><dt>TERM</dt><dd>DEF</dd></div> pairs -> one line per pair
 *    `**TERM** — DEF` (em-dash U+2014, spaced).
 *  - A bare <pre class="study-pre"> -> fenced code block with VERBATIM text;
 *    opening fence is a backtick run strictly longer than the longest backtick
 *    run inside the text, and at least 3. `#` lines stay literal inside.
 *  - No leftover raw HTML for these structures; never throws; no mutation.
 *
 * The function operates on the content of the page's <main> element, so every
 * fixture wraps its content in <main class="container">...</main>.
 */

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) + helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ITERATIONS = 60;
const BASE_SEED = 0x1a14ce;

function makeRng(propertyIndex: number, iteration: number): () => number {
  // Distinct, reproducible stream per (property, iteration).
  return mulberry32((BASE_SEED ^ (propertyIndex * 0x9e3779b1) ^ (iteration * 0x85ebca6b)) >>> 0);
}

function randInt(rng: () => number, min: number, max: number): number {
  // inclusive range
  return min + Math.floor(rng() * (max - min + 1));
}

const ALPHANUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Random simple word (alphanumerics only), length 1..len. */
function randWord(rng: () => number, len = 6): string {
  const n = randInt(rng, 1, len);
  let out = '';
  for (let i = 0; i < n; i++) {
    out += ALPHANUM[randInt(rng, 0, ALPHANUM.length - 1)];
  }
  return out;
}

/** Random simple text: 1..words words of alphanumerics, space-separated. */
function randText(rng: () => number, words = 3): string {
  const n = randInt(rng, 1, words);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) parts.push(randWord(rng, 5));
  return parts.join(' ');
}

function wrapMain(inner: string): string {
  return `<main class="container">${inner}</main>`;
}

/** Escape regex metacharacters in a literal substring. */
function reEsc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Property 1: random table -> separator of exactly C `---`, one pipe line per
// body row plus header, header + body cell text present.
// ---------------------------------------------------------------------------

describe('renderPageMarkdown — table structure (property)', () => {
  it('produces a GFM pipe table with correct separator and row counts', () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const rng = makeRng(1, iter);
      const cols = randInt(rng, 1, 5);
      const bodyRows = randInt(rng, 1, 6);

      const headers: string[] = [];
      for (let c = 0; c < cols; c++) headers.push(randText(rng, 2));

      const body: string[][] = [];
      for (let r = 0; r < bodyRows; r++) {
        const row: string[] = [];
        for (let c = 0; c < cols; c++) row.push(randText(rng, 2));
        body.push(row);
      }

      const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${body
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      const html = wrapMain(`<table>${thead}${tbody}</table>`);

      const out = renderPageMarkdown(html);

      // Separator row: exactly `cols` cells of `---`.
      const sepLines = out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^\|(\s*---\s*\|)+$/.test(l));
      expect(sepLines.length).toBe(1);
      // Normalise whitespace inside the separator before comparing cell count.
      const sepCells = sepLines[0]
        .split('|')
        .slice(1, -1) // drop leading/trailing empties from the outer pipes
        .map((c) => c.trim());
      expect(sepCells.length).toBe(cols);
      for (const c of sepCells) expect(c).toBe('---');

      // Count markdown pipe lines: lines starting with `|`. Should be
      // header + separator + one per body row.
      const pipeLines = out.split('\n').filter((l) => /^\|/.test(l));
      expect(pipeLines.length).toBe(bodyRows + 2); // header + separator + body rows

      // Header lines == body rows + 1 when ignoring the separator (spec phrasing
      // "^\| lines == R+1" for header+body; separator is the extra structural line).
      const nonSepPipeLines = pipeLines.filter((l) => !/^\|(\s*---\s*\|)+$/.test(l.trim()));
      expect(nonSepPipeLines.length).toBe(bodyRows + 1);

      // Each header and body cell text appears in the output.
      for (const h of headers) expect(out).toContain(h);
      for (const row of body) for (const cell of row) expect(out).toContain(cell);

      // No leftover raw <table>/<td>/<th>/<tr> tags.
      expect(out).not.toMatch(/<\/?(table|thead|tbody|tr|td|th)\b/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 2: pipe escaping. Cell text containing `|` must appear escaped as
// `\|`; column count per row stays constant == C.
// ---------------------------------------------------------------------------

describe('renderPageMarkdown — table pipe escaping (property)', () => {
  it('escapes literal `|` in cells and keeps column count constant', () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const rng = makeRng(2, iter);
      const cols = randInt(rng, 2, 4);
      const bodyRows = randInt(rng, 1, 5);

      const headers: string[] = [];
      for (let c = 0; c < cols; c++) headers.push(randWord(rng, 5));

      // Build body cells that each contain a `|` somewhere.
      const body: string[][] = [];
      const dataPipeFragments: string[] = [];
      for (let r = 0; r < bodyRows; r++) {
        const row: string[] = [];
        for (let c = 0; c < cols; c++) {
          const left = randWord(rng, 4);
          const right = randWord(rng, 4);
          const cell = `${left}|${right}`;
          row.push(cell);
          dataPipeFragments.push(`${left}\\|${right}`);
        }
        body.push(row);
      }

      const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${body
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      const html = wrapMain(`<table>${thead}${tbody}</table>`);

      const out = renderPageMarkdown(html);

      // Every data pipe is escaped: the escaped fragment must be present...
      for (const frag of dataPipeFragments) expect(out).toContain(frag);

      // ...and there is no UNescaped data pipe: the literal `left|right` (with a
      // bare `|`, not preceded by a backslash) from the data must not appear.
      // We check that no `<word>|<word>` style data pipe survives unescaped by
      // confirming every `|` in a table body line is either a column separator
      // or backslash-escaped.
      const pipeLines = out.split('\n').filter((l) => /^\|/.test(l.trim()));
      const sepRe = /^\|(\s*---\s*\|)+$/;
      const bodyAndHeaderLines = pipeLines.filter((l) => !sepRe.test(l.trim()));

      for (const line of bodyAndHeaderLines) {
        // Count UNescaped column separators ` | ` style: pipes not preceded by `\`.
        // A row of C columns rendered as `| a | b | ... |` has C+1 structural pipes.
        let structural = 0;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '|' && line[i - 1] !== '\\') structural++;
        }
        expect(structural).toBe(cols + 1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Property 3: <dl> -> `**TERM** — DEF` per pair (em-dash U+2014), K lines.
// ---------------------------------------------------------------------------

describe('renderPageMarkdown — definition list (property)', () => {
  const EM_DASH = '—'; // U+2014

  it('renders one `**TERM** — DEF` line per pair with all text present', () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const rng = makeRng(3, iter);
      const pairs = randInt(rng, 1, 6);

      const terms: string[] = [];
      const defs: string[] = [];
      let inner = '';
      for (let k = 0; k < pairs; k++) {
        const term = randText(rng, 2);
        const def = randText(rng, 3);
        terms.push(term);
        defs.push(def);
        inner += `<div><dt>${term}</dt><dd>${def}</dd></div>`;
      }
      const html = wrapMain(`<dl>${inner}</dl>`);

      const out = renderPageMarkdown(html);

      // Exactly K lines matching `^\*\*.+\*\* — .+`.
      const dlLineRe = new RegExp(`^\\*\\*.+\\*\\* ${EM_DASH} .+$`);
      const dlLines = out.split('\n').filter((l) => dlLineRe.test(l.trim()));
      expect(dlLines.length).toBe(pairs);

      // Each pair's exact rendered line is present, and term/def substrings appear.
      for (let k = 0; k < pairs; k++) {
        const expectedLine = `**${terms[k]}** ${EM_DASH} ${defs[k]}`;
        expect(out).toContain(expectedLine);
        expect(out).toContain(terms[k]);
        expect(out).toContain(defs[k]);
      }

      // No leftover raw <dl>/<dt>/<dd> tags.
      expect(out).not.toMatch(/<\/?(dl|dt|dd)\b/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 4: bare <pre class="study-pre"> -> fence length F >= 3 and F > B,
// verbatim text (incl. the backtick run) preserved.
// ---------------------------------------------------------------------------

describe('renderPageMarkdown — fenced study-pre with backtick runs (property)', () => {
  it('chooses fence length > longest inner backtick run and preserves text', () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const rng = makeRng(4, iter);
      const backtickRun = randInt(rng, 0, 5); // B
      const ticks = '`'.repeat(backtickRun);

      // Build verbatim content: some plain lines plus a line embedding the run.
      const preLines: string[] = [];
      const nBefore = randInt(rng, 0, 2);
      for (let i = 0; i < nBefore; i++) preLines.push(randText(rng, 4));
      const marker = randWord(rng, 4);
      // Place the backtick run in the middle of a line so it is unambiguous.
      preLines.push(`${marker}${ticks}${randWord(rng, 4)}`);
      const nAfter = randInt(rng, 0, 2);
      for (let i = 0; i < nAfter; i++) preLines.push(randText(rng, 4));

      const verbatim = preLines.join('\n');
      const html = wrapMain(`<pre class="study-pre">${verbatim}</pre>`);

      const out = renderPageMarkdown(html);

      // Find the opening fence: a line that is a pure run of >=3 backticks
      // (optionally followed by an info string). The spec says the fence is a
      // run of backticks; capture the longest such fence line.
      const fenceLines = out
        .split('\n')
        .map((l) => l.match(/^(`{3,})/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => m[1].length);

      expect(fenceLines.length).toBeGreaterThanOrEqual(2); // open + close
      const fenceLen = Math.max(...fenceLines);
      expect(fenceLen).toBeGreaterThanOrEqual(3); // F >= 3
      expect(fenceLen).toBeGreaterThan(backtickRun); // F > B

      // Verbatim text preserved, including the backtick run line.
      for (const line of preLines) expect(out).toContain(line);
      if (backtickRun > 0) expect(out).toContain(`${marker}${ticks}`);

      // No leftover raw <pre> tag.
      expect(out).not.toMatch(/<\/?pre\b/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 5: a `## heading`-looking line inside study-pre stays fenced
// (literal), not a real top-level heading.
// ---------------------------------------------------------------------------

describe('renderPageMarkdown — study-pre `#` lines stay literal (property)', () => {
  it('keeps a `## ...` line fenced rather than rendering a heading', () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const rng = makeRng(5, iter);

      const before: string[] = [];
      const nBefore = randInt(rng, 0, 2);
      for (let i = 0; i < nBefore; i++) before.push(randText(rng, 3));

      const headingText = randText(rng, 3);
      const headingLine = `## ${headingText}`;

      const after: string[] = [];
      const nAfter = randInt(rng, 0, 2);
      for (let i = 0; i < nAfter; i++) after.push(randText(rng, 3));

      const preLines = [...before, headingLine, ...after];
      const verbatim = preLines.join('\n');
      const html = wrapMain(`<pre class="study-pre">${verbatim}</pre>`);

      const out = renderPageMarkdown(html);
      const lines = out.split('\n');

      // The exact `## heading` raw line is present verbatim.
      const headingIdx = lines.findIndex((l) => l === headingLine);
      expect(headingIdx).toBeGreaterThanOrEqual(0);

      // It must sit between a fence opening before it and a fence closing after
      // it: there is a `^`{3,}`` fence line before the heading and one after.
      const fenceIdxs: number[] = [];
      lines.forEach((l, i) => {
        if (/^`{3,}\s*$/.test(l) || /^`{3,}\S*$/.test(l)) fenceIdxs.push(i);
      });
      const openBefore = fenceIdxs.filter((i) => i < headingIdx);
      const closeAfter = fenceIdxs.filter((i) => i > headingIdx);
      expect(openBefore.length).toBeGreaterThanOrEqual(1);
      expect(closeAfter.length).toBeGreaterThanOrEqual(1);

      // The heading text, taken alone, is not a markdown heading rendered as
      // bare `## text` at the very top level OUTSIDE a fence: confirm that the
      // only occurrence of the exact heading line is the fenced one we found.
      const occurrences = lines.filter((l) => l === headingLine).length;
      // Region check: every occurrence lies inside a fenced region.
      // With a single study-pre, there should be exactly one occurrence and it
      // is between the surrounding fence pair.
      expect(occurrences).toBe(1);

      // Sanity: there is a fence open immediately bounding the pre content
      // (nearest fence before the heading) and a matching close after.
      const nearestOpen = Math.max(...openBefore);
      const nearestClose = Math.min(...closeAfter);
      expect(nearestOpen).toBeLessThan(headingIdx);
      expect(nearestClose).toBeGreaterThan(headingIdx);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 6: determinism + no mutation of the argument.
// ---------------------------------------------------------------------------

describe('renderPageMarkdown — determinism & no mutation (property)', () => {
  it('is deterministic and does not mutate its input string', () => {
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const rng = makeRng(6, iter);

      // Assemble a mixed fixture from the supported structures.
      const fragments: string[] = [];
      const choices = randInt(rng, 1, 3);
      for (let i = 0; i < choices; i++) {
        const kind = randInt(rng, 0, 2);
        if (kind === 0) {
          // table
          const cols = randInt(rng, 1, 3);
          const rows = randInt(rng, 1, 3);
          const hs = Array.from({ length: cols }, () => randWord(rng, 4));
          const head = `<thead><tr>${hs.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`;
          let bod = '<tbody>';
          for (let r = 0; r < rows; r++) {
            bod += `<tr>${Array.from({ length: cols }, () => `<td>${randWord(rng, 4)}</td>`).join('')}</tr>`;
          }
          bod += '</tbody>';
          fragments.push(`<table>${head}${bod}</table>`);
        } else if (kind === 1) {
          // dl
          const pairs = randInt(rng, 1, 3);
          let inner = '';
          for (let k = 0; k < pairs; k++) {
            inner += `<div><dt>${randText(rng, 2)}</dt><dd>${randText(rng, 2)}</dd></div>`;
          }
          fragments.push(`<dl>${inner}</dl>`);
        } else {
          // study-pre
          const ticks = '`'.repeat(randInt(rng, 0, 4));
          const txt = `${randText(rng, 3)}\n${randWord(rng, 4)}${ticks}${randWord(rng, 4)}\n## ${randText(rng, 2)}`;
          fragments.push(`<pre class="study-pre">${txt}</pre>`);
        }
      }

      const s = wrapMain(fragments.join('\n'));
      const sCopy = String(s);

      const first = renderPageMarkdown(s);
      const second = renderPageMarkdown(s);

      // Determinism.
      expect(second).toBe(first);
      // Argument unchanged (string primitives are immutable, but assert the
      // value the caller still holds is identical to the pre-call snapshot).
      expect(s).toBe(sCopy);
      // Never throws is implied by reaching here without an exception.
      expect(typeof first).toBe('string');
    }
  });
});

// Silence unused-helper lint if reEsc ends up unreferenced in some configs.
void reEsc;
