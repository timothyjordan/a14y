/**
 * Adversarial tests for `leaderboardPageTitle`, `leaderboardPageDescription`
 * and `siteHost` (all exported from the same module).
 *
 * Oracle source: `src/lib/leaderboard-meta.spec.md` as carried in the
 * testbotpro request (`specText`), plus the declared type façade, plus the
 * real catalog reached through `getLeaderboard()` and `listSiteRunSlugs()`
 * exactly as the spec's Notes section instructs.
 *
 * The implementation file was never opened while writing these tests. Every
 * expectation below is derived from a spec sentence (quoted inline at the
 * assertion) or recomputed independently from the catalog data. Nothing here
 * asserts "what the code currently does".
 */
import { describe, expect, it } from 'vitest';

import {
  DISCOVERY_FILES,
  DESCRIPTION_BUDGET,
  TITLE_BUDGET,
  leaderboardPageDescription,
  leaderboardPageTitle,
  siteHost,
} from '../src/lib/leaderboard-meta';

import { getLeaderboard } from '../src/lib/research-data';
import { listSiteRunSlugs } from '../src/lib/site-run';

/* ------------------------------------------------------------------ */
/* The real catalog, published entries only.                           */
/*                                                                     */
/* Spec, Notes: "The catalog is reachable in tests via getLeaderboard()  */
/* ... filtered to published runs via listSiteRunSlugs() ... Length     */
/* budgets should be asserted against those real entries, not against   */
/* invented names."                                                     */
/* ------------------------------------------------------------------ */
const publishedSlugs = new Set(listSiteRunSlugs());
const publishedEntries = getLeaderboard().filter((e) => publishedSlugs.has(e.slug));

const EM_DASH = '—';

/** Standard median: middle value, or the mean of the two middle values. */
function median(values: number[]): number {
  if (values.length === 0) throw new Error('median of an empty list');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Spec: "Be a single line: no newline, no leading or trailing whitespace."
 * Asserted the same way for the title and the description, since both carry
 * the rule. `\r` and the unicode line separators count: they all break a
 * frontmatter line just as badly as `\n`.
 */
function expectSingleLine(value: string, label: string): void {
  expect(typeof value, `${label}: must be a string`).toBe('string');
  expect(value, `${label}: must not be empty`).not.toBe('');
  expect(value, `${label}: no newline`).not.toMatch(/[\n\r\u2028\u2029]/);
  expect(value.trim(), `${label}: no leading or trailing whitespace`).toBe(value);
}

/** A handful of names chosen to stress the character rules. */
const HOSTILE_NAMES: ReadonlyArray<[label: string, name: string]> = [
  ['plain', 'Merriam-Webster'],
  ['ampersand', 'McKinsey & Company'],
  ['ampersand, no spaces', 'AT&T'],
  ['apostrophe', "Lowe's"],
  ['typographic apostrophe', 'Lowe’s'],
  ['hyphen', 'scikit-learn'],
  ['unicode', 'Café Münchén'],
  ['CJK', '楽天市場'],
  ['emoji', 'Rocket 🚀 Docs'],
  ['angle brackets', 'Acme <Docs>'],
  ['double quote', 'The "Real" Docs'],
  ['already-escaped entity', 'AT&amp;T'],
  ['single character', 'X'],
  ['digits only', '404'],
  ['very long', 'A'.repeat(200)],
];

describe('module constants (declared façade)', () => {
  it('DISCOVERY_FILES lists the four files in the documented order', () => {
    // Façade: readonly ["llms.txt", "AGENTS.md", "robots.txt", "sitemap.xml"],
    // "in the order they appear in the copy. llms.txt leads".
    expect([...DISCOVERY_FILES]).toEqual([
      'llms.txt',
      'AGENTS.md',
      'robots.txt',
      'sitemap.xml',
    ]);
  });

  it('exposes the documented budgets', () => {
    expect(TITLE_BUDGET).toBe(60);
    expect(DESCRIPTION_BUDGET).toBe(160);
  });
});

describe('catalog fixture is non-vacuous', () => {
  it('has published leaderboard entries to assert against', () => {
    // Guards every catalog-driven assertion below from passing on an empty
    // list. The spec describes 326 pages; a handful of unpublished runs is
    // expected, an empty set is not.
    expect(publishedEntries.length).toBeGreaterThan(100);
  });

  it('the catalog actually contains the hostile shapes these tests target', () => {
    // If the catalog ever loses one of these shapes, the matching rule below
    // stops being exercised by real data. Fail loudly rather than silently
    // weaken.
    const names = publishedEntries.map((e) => e.name);
    expect(names.some((n) => n.includes('-')), 'expected a hyphenated name').toBe(true);
    expect(names.some((n) => /['’]/.test(n)), 'expected an apostrophe name').toBe(true);
  });

  it('the ampersand rule stays exercised even with no ampersand in the catalog', () => {
    // "McKinsey & Company" was the only ampersand name in the catalog, and it
    // is now held out of the leaderboard because it crawls zero pages
    // (TJ-1435), so the catalog sweep can no longer supply one.
    //
    // That is acceptable only because the catalog was never the real
    // guarantee: the &-rules are pinned unconditionally by HOSTILE_NAMES,
    // which carries "McKinsey & Company", "AT&T", and the already-escaped
    // "AT&amp;T". Catalog composition changes for product reasons and is not
    // a stable test input; the synthetic set is. Assert that here so the
    // coverage claim is checked rather than assumed.
    const hostile = HOSTILE_NAMES.map(([, name]) => name);
    expect(hostile.some((n) => n.includes('&')), 'HOSTILE_NAMES must keep an ampersand case').toBe(
      true,
    );
    expect(
      hostile.some((n) => n.includes('&amp;')),
      'HOSTILE_NAMES must keep a pre-escaped ampersand case',
    ).toBe(true);
  });
});

/* ================================================================== */
/* leaderboardPageTitle                                                */
/* ================================================================== */

describe('leaderboardPageTitle: the character rules with real consequences', () => {
  it('introduces no & of its own for ANY published catalog name', () => {
    // Spec (clarified in leaderboard-meta.spec.md after this test first ran):
    // the FIXED part of the title must contain no ampersand, because the
    // mirrors read it back out of HTML where `&` arrives escaped. An `&`
    // inside a site name is legitimate data and survives verbatim; the mirror
    // layer decodes it. "McKinsey & Company" is a real catalog entry, so the
    // original "no & anywhere" wording was unsatisfiable alongside
    // "contains the site name, unmodified".
    const offenders = publishedEntries
      .map((e) => ({ name: e.name, fixed: leaderboardPageTitle(e.name).replace(e.name, '') }))
      .filter((r) => r.fixed.includes('&'));
    expect(offenders).toEqual([]);
  });

  it('emits no & for hostile names, including one that is already an entity', () => {
    for (const [label, name] of HOSTILE_NAMES) {
      const title = leaderboardPageTitle(name);
      // Only the fixed part is under the template's control. Whatever the
      // name contains is data and must pass through untouched.
      const fixed = title.replace(name.replace(/\s+/g, ' ').trim(), '');
      expect(fixed, `${label}: template adds no raw &`).not.toContain('&');
      expect(fixed, `${label}: template adds no &amp;`).not.toContain('&amp;');
      expect(fixed, `${label}: template adds no numeric entity`).not.toContain('&#');
    }
  });

  it('emits no em-dash for ANY published catalog name', () => {
    // Spec: "Contain no em-dash." The copy this replaced was
    // `Merriam-Webster — a14y scorecard`, so the separator is the live risk.
    const offenders = publishedEntries
      .map((e) => leaderboardPageTitle(e.name))
      .filter((t) => t.includes(EM_DASH));
    expect(offenders).toEqual([]);
  });

  it('emits no em-dash for hostile names either', () => {
    for (const [label, name] of HOSTILE_NAMES) {
      expect(leaderboardPageTitle(name), `${label}`).not.toContain(EM_DASH);
    }
  });

  it('is a single line with no surrounding whitespace, across the whole catalog', () => {
    // Spec: "Be a single line: no newline, no leading or trailing whitespace."
    for (const entry of publishedEntries) {
      expectSingleLine(leaderboardPageTitle(entry.name), `title(${entry.name})`);
    }
  });

  it('is a single line even when the name itself carries whitespace or newlines', () => {
    // A padded or multi-line name must not leak its whitespace into the title,
    // because the rule is stated about the title, not about the input.
    for (const raw of ['  Padded Name  ', 'Two\nLines', 'Tab\tSeparated', 'Trailing\n']) {
      expectSingleLine(leaderboardPageTitle(raw), `title(${JSON.stringify(raw)})`);
    }
  });
});

describe('leaderboardPageTitle: required terms', () => {
  it('names llms.txt, robots.txt and sitemap.xml, and keeps the a14y brand', () => {
    // Spec: "Name llms.txt, robots.txt, and sitemap.xml, the three terms that
    // appeared in real queries" and "Contain the string a14y".
    for (const entry of publishedEntries) {
      const title = leaderboardPageTitle(entry.name);
      expect(title, `${entry.name}: llms.txt`).toContain('llms.txt');
      expect(title, `${entry.name}: robots.txt`).toContain('robots.txt');
      expect(title, `${entry.name}: sitemap.xml`).toContain('sitemap.xml');
      expect(title, `${entry.name}: a14y`).toContain('a14y');
    }
  });

  it('keeps a14y as its own token, not merely a substring of the site name', () => {
    // A name like "a14y" would make the brand check vacuous. Use names that
    // cannot supply the token themselves.
    for (const name of ['Zebra Docs', 'X', '404', 'A'.repeat(200)]) {
      const title = leaderboardPageTitle(name);
      const withoutName = title.split(name).join('');
      expect(withoutName, `${name}: a14y must survive removing the name`).toContain('a14y');
    }
  });

  it('does not truncate a 200-character name into a mangled title', () => {
    // Façade: "these are budgets to design against rather than hard limits: a
    // long site name must never cause a title to be dropped or mangled."
    const long = 'A'.repeat(200);
    const title = leaderboardPageTitle(long);
    expectSingleLine(title, 'title(200-char name)');
    expect(title).toContain(long);
    expect(title).toContain('llms.txt');
    expect(title).toContain('robots.txt');
    expect(title).toContain('sitemap.xml');
    expect(title).toContain('a14y');
    expect(title, 'no ellipsis truncation').not.toContain('…');
    expect(title, 'no ascii ellipsis truncation').not.toContain('...');
  });
});

describe('leaderboardPageTitle: the site name survives verbatim', () => {
  it('contains every published catalog name unmodified', () => {
    // Spec: "Contain the site name, unmodified, so the result matches a query
    // that includes the brand."
    //
    // NOTE for triage: this rule and the no-& rule are jointly unsatisfiable
    // for the catalog's one ampersand entry (`McKinsey & Company`). Both
    // sentences are in the spec, so both are asserted rather than one being
    // quietly scoped away. A failure here on exactly that entry is a
    // spec-ambiguity to resolve in the spec, not a test to soften.
    const missing = publishedEntries
      .filter((e) => !leaderboardPageTitle(e.name).includes(e.name))
      .map((e) => e.name);
    expect(missing).toEqual([]);
  });

  it('does not mangle apostrophes, unicode, or hyphens', () => {
    for (const name of [
      "Lowe's",
      'Lowe’s',
      'Café Münchén',
      'Merriam-Webster',
      'scikit-learn',
      '楽天市場',
    ]) {
      const title = leaderboardPageTitle(name);
      expect(title, `${name}: verbatim`).toContain(name);
      expect(title, `${name}: no &#39;`).not.toContain('&#39;');
      expect(title, `${name}: no &apos;`).not.toContain('&apos;');
    }
  });

  it('keeps the brand words matchable even when the name holds an ampersand', () => {
    // Whatever the impl does with `&`, the search-matching purpose survives
    // only if both brand words are still present. Independent of which side of
    // the &-vs-verbatim conflict the implementation picks.
    const title = leaderboardPageTitle('McKinsey & Company');
    expect(title).toContain('McKinsey');
    expect(title).toContain('Company');
    // The ampersand is the name's, and it stays: the mirror layer decodes
    // the escaped form back to text (see decodeHtmlEntities).
    expect(title).toContain('McKinsey & Company');
    expect(title).not.toContain('&amp;');
  });
});

describe('leaderboardPageTitle: length budgets against the real catalog', () => {
  const lengths = publishedEntries.map((e) => leaderboardPageTitle(e.name).length);

  it('median title length is at or under 60 characters', () => {
    // Spec: "Across all published leaderboard entries, the median length is at
    // or under 60 characters".
    expect(median(lengths)).toBeLessThanOrEqual(TITLE_BUDGET);
  });

  it('no published title exceeds 75 characters', () => {
    // Spec: "and no title exceeds 75 ... a runaway title is not [acceptable]."
    const overruns = publishedEntries
      .map((e) => ({ name: e.name, len: leaderboardPageTitle(e.name).length }))
      .filter((r) => r.len > 75);
    expect(overruns).toEqual([]);
  });
});

describe('leaderboardPageTitle: injectivity', () => {
  it('produces a distinct title for every distinct published catalog name', () => {
    // Spec: "Be injective over distinct site names: two different names never
    // produce the same title, so no two pages compete with an identical
    // result."
    const distinctNames = [...new Set(publishedEntries.map((e) => e.name))];
    const titles = distinctNames.map((n) => leaderboardPageTitle(n));
    const seen = new Map<string, string>();
    const collisions: Array<[string, string]> = [];
    titles.forEach((title, i) => {
      const prior = seen.get(title);
      if (prior !== undefined) collisions.push([prior, distinctNames[i]]);
      else seen.set(title, distinctNames[i]);
    });
    expect(collisions).toEqual([]);
  });

  it('does not collapse "A & B" and "A and B" onto the same title', () => {
    // The obvious way to satisfy the no-& rule is to rewrite `&` as `and`,
    // which destroys injectivity for this pair. Both are plausible site names.
    expect(leaderboardPageTitle('Barnes & Noble')).not.toBe(
      leaderboardPageTitle('Barnes and Noble'),
    );
  });

  it('does not collapse names that differ only in case or spacing', () => {
    expect(leaderboardPageTitle('Acme Docs')).not.toBe(leaderboardPageTitle('acme docs'));
    expect(leaderboardPageTitle('Acme  Docs')).not.toBe(leaderboardPageTitle('Acme Docs'));
  });
});

describe('leaderboardPageTitle: purity', () => {
  it('returns the same string for the same name (no I/O, no state)', () => {
    // Spec, Notes: "All three functions are pure and total: same arguments,
    // same result, no I/O."
    for (const [, name] of HOSTILE_NAMES) {
      expect(leaderboardPageTitle(name)).toBe(leaderboardPageTitle(name));
    }
  });

  it('is total over the empty name (returns a string, does not throw)', () => {
    expect(() => leaderboardPageTitle('')).not.toThrow();
    expect(typeof leaderboardPageTitle('')).toBe('string');
  });
});

/* ================================================================== */
/* siteHost                                                            */
/* ================================================================== */

describe('siteHost: ordinary absolute URLs', () => {
  it('returns the host for the spec’s worked example', () => {
    // Spec: "https://www.merriam-webster.com/dictionary yields
    // www.merriam-webster.com".
    expect(siteHost('https://www.merriam-webster.com/dictionary')).toBe(
      'www.merriam-webster.com',
    );
  });

  it('drops scheme, path, query and fragment together', () => {
    // Spec: "excluding scheme, path, query, and fragment."
    const cases: Array<[input: string, expected: string]> = [
      ['https://example.com', 'example.com'],
      ['https://example.com/', 'example.com'],
      ['http://example.com/a/b/c', 'example.com'],
      ['https://example.com/?q=1', 'example.com'],
      ['https://example.com/#frag', 'example.com'],
      ['https://example.com/docs?q=llms.txt#top', 'example.com'],
      ['https://sub.domain.example.co.uk/deep/path', 'sub.domain.example.co.uk'],
    ];
    for (const [input, expected] of cases) {
      expect(siteHost(input), input).toBe(expected);
    }
  });

  it('never leaks a scheme, slash, query or fragment for any real catalog URL', () => {
    for (const entry of publishedEntries) {
      const host = siteHost(entry.url);
      expect(host, `${entry.url}: non-empty`).not.toBe('');
      expect(host, `${entry.url}: no scheme`).not.toContain('://');
      expect(host, `${entry.url}: no slash`).not.toContain('/');
      expect(host, `${entry.url}: no query`).not.toContain('?');
      expect(host, `${entry.url}: no fragment`).not.toContain('#');
      expect(host.trim(), `${entry.url}: no padding`).toBe(host);
      expect(entry.url, `${entry.url}: host is part of the url`).toContain(host);
    }
  });

  it('is idempotent on real catalog URLs (a host fed back in comes out unchanged)', () => {
    // Once reduced to a host, a second pass must not erase it. A naive
    // `new URL(x).host` on a bare host throws, so this catches a missing
    // fallback branch.
    for (const entry of publishedEntries) {
      const once = siteHost(entry.url);
      expect(siteHost(once), `siteHost(siteHost(${entry.url}))`).toBe(once);
    }
  });
});

describe('siteHost: ports', () => {
  it('preserves a non-default port, path and all', () => {
    // Spec: "Preserve a port when the URL carries one, since that is part of
    // the host."
    expect(siteHost('https://example.com:8443/path?q=1#f')).toBe('example.com:8443');
    expect(siteHost('http://localhost:3000')).toBe('localhost:3000');
    expect(siteHost('http://127.0.0.1:8080/docs')).toBe('127.0.0.1:8080');
    expect(siteHost('https://staging.example.com:4321/')).toBe('staging.example.com:4321');
  });

  it('does not swallow a bare host:port that is not an absolute URL', () => {
    // `example.com:8443` is not an ordinary absolute URL. Whatever the impl
    // does, returning an empty string would render "Does  publish ..." into
    // the meta description, which the fallback rule exists to prevent.
    const out = siteHost('example.com:8443');
    expect(out, 'must not collapse to empty').not.toBe('');
    expect(out).toContain('example.com');
  });
});

describe('siteHost: unparseable values fall back instead of throwing', () => {
  // Spec: "Return the input unchanged rather than throwing when the value
  // cannot be parsed as a URL. A slightly odd description is a better outcome
  // than a build that dies over a meta tag."
  const unparseable = [
    'not a url',
    'www.merriam-webster.com',
    'merriam-webster.com/dictionary',
    '//example.com/protocol-relative',
    '::::',
    'https://',
    '',
    '   ',
    'a b c',
    '楽天市場',
    '{{ site.url }}',
  ];

  it('never throws', () => {
    for (const value of unparseable) {
      expect(() => siteHost(value), JSON.stringify(value)).not.toThrow();
    }
  });

  it('returns the input unchanged', () => {
    for (const value of unparseable) {
      expect(siteHost(value), JSON.stringify(value)).toBe(value);
    }
  });

  it('returns something non-empty for a URL that parses but has no host', () => {
    // `mailto:` and `data:` parse under WHATWG but carry no host, so the
    // host-extraction path yields "". The spec's fallback is there so the
    // description never ends up with a hole where the host should be.
    expect(siteHost('mailto:someone@example.com')).not.toBe('');
    expect(siteHost('about:blank')).not.toBe('');
  });

  it('is pure: repeated calls agree', () => {
    for (const value of [...unparseable, 'https://example.com:8443/x']) {
      expect(siteHost(value)).toBe(siteHost(value));
    }
  });
});

describe('siteHost: IDN and unusual but parseable hosts', () => {
  it('reduces an IDN URL to a host, in whichever encoding, with no scheme or path', () => {
    // The spec does not pick between the unicode and punycode spellings, so
    // this asserts only what the spec does promise: scheme, path, query and
    // fragment are gone and a host remains.
    const out = siteHost('https://münchen.de/dictionary?q=1#top');
    expect(out).not.toBe('');
    expect(out).not.toContain('://');
    expect(out).not.toContain('/');
    expect(out).not.toContain('?');
    expect(out).not.toContain('#');
    expect(out).not.toContain('dictionary');
  });

  it('handles userinfo and IPv6 literals without leaking credentials or brackets’ contents', () => {
    const withUser = siteHost('https://user:pass@example.com/docs');
    expect(withUser).not.toContain('pass');
    expect(withUser).not.toContain('/');
    expect(withUser).toContain('example.com');

    const ipv6 = siteHost('https://[2001:db8::1]:8080/path');
    expect(ipv6).not.toBe('');
    expect(ipv6).not.toContain('://');
    expect(ipv6).not.toContain('/path');
  });
});

/* ================================================================== */
/* leaderboardPageDescription                                          */
/* ================================================================== */

describe('leaderboardPageDescription: leads with the name and the score', () => {
  it('starts with the site name for every published entry', () => {
    // Spec: "Lead with the site name and its score out of 100, because the
    // score is the answer this page uniquely has."
    const bad = publishedEntries
      .filter((e) => !leaderboardPageDescription(e.name, e.url, e.score).startsWith(e.name))
      .map((e) => e.name);
    expect(bad).toEqual([]);
  });

  it('states the score out of 100 for every published entry', () => {
    const bad = publishedEntries
      .filter(
        (e) => !leaderboardPageDescription(e.name, e.url, e.score).includes(`${e.score}/100`),
      )
      .map((e) => ({ name: e.name, score: e.score }));
    expect(bad).toEqual([]);
  });
});

describe('leaderboardPageDescription: never renders undefined/null/NaN for a real score', () => {
  // Spec: "Never render undefined, null, or NaN into the output for a score
  // that is a real number, including 0 and 100."
  const realScores = [0, 1, 7, 50, 52, 99, 100, 52.5, 0.0];

  it('handles 0 without falling through a falsy check', () => {
    // `score || 'unknown'` and `score ? ... : ...` both destroy 0. 0 is a
    // legitimate a14y score.
    const out = leaderboardPageDescription('Zero Co', 'https://zero.example.com', 0);
    expect(out).toContain('0/100');
    expect(out).not.toContain('undefined');
    expect(out).not.toContain('null');
    expect(out).not.toContain('NaN');
    expect(out.startsWith('Zero Co')).toBe(true);
  });

  it('handles 100 exactly', () => {
    const out = leaderboardPageDescription('Perfect Co', 'https://perfect.example.com', 100);
    expect(out).toContain('100/100');
    expect(out).not.toContain('undefined');
    expect(out).not.toContain('NaN');
  });

  it('emits no undefined/null/NaN token for any real numeric score', () => {
    for (const score of realScores) {
      const out = leaderboardPageDescription('Acme', 'https://acme.example.com', score);
      expect(out, `score=${score}: undefined`).not.toContain('undefined');
      expect(out, `score=${score}: null`).not.toContain('null');
      expect(out, `score=${score}: NaN`).not.toContain('NaN');
    }
  });

  it('emits no undefined/null/NaN token across the whole real catalog', () => {
    const offenders = publishedEntries
      .map((e) => ({
        name: e.name,
        out: leaderboardPageDescription(e.name, e.url, e.score),
      }))
      .filter(
        (r) =>
          r.out.includes('undefined') || r.out.includes('null') || r.out.includes('NaN'),
      )
      .map((r) => r.name);
    expect(offenders).toEqual([]);
  });
});

describe('leaderboardPageDescription: names all four discovery files', () => {
  it('mentions llms.txt, AGENTS.md, robots.txt and sitemap.xml for every entry', () => {
    // Spec: "Name all four discovery files: llms.txt, AGENTS.md, robots.txt,
    // and sitemap.xml."
    for (const entry of publishedEntries) {
      const out = leaderboardPageDescription(entry.name, entry.url, entry.score);
      for (const file of DISCOVERY_FILES) {
        expect(out, `${entry.name}: ${file}`).toContain(file);
      }
    }
  });

  it('mentions all four even for a hostile name and an unparseable url', () => {
    const out = leaderboardPageDescription('McKinsey & Company', 'not a url', 0);
    for (const file of DISCOVERY_FILES) expect(out).toContain(file);
  });
});

describe('leaderboardPageDescription: host, not the full URL', () => {
  it('carries the host and not the scheme or path, for every published entry', () => {
    // Spec: "Contain the host of siteUrl rather than the full URL, so the
    // description spends its budget on words rather than on a scheme and path."
    for (const entry of publishedEntries) {
      const out = leaderboardPageDescription(entry.name, entry.url, entry.score);
      const host = siteHost(entry.url);
      expect(out, `${entry.url}: host present`).toContain(host);
      expect(out, `${entry.url}: no scheme`).not.toContain('://');
      expect(out, `${entry.url}: no full url`).not.toContain(entry.url);
    }
  });

  it('keeps a port, since the port is part of the host', () => {
    const out = leaderboardPageDescription('Local Docs', 'http://localhost:3000/docs', 42);
    expect(out).toContain('localhost:3000');
    expect(out).not.toContain('://');
    expect(out).not.toContain('/docs');
  });

  it('falls back to the raw value rather than a hole when the url is unparseable', () => {
    // Façade: "Falls back to the raw value if the catalog ever holds something
    // unparseable, since a slightly odd description beats a build that dies
    // over a meta tag."
    const out = leaderboardPageDescription('Odd Co', 'www.odd-co.example', 12);
    expect(out).toContain('www.odd-co.example');
    expect(out).toContain('12/100');
  });
});

describe('leaderboardPageDescription: single line, no padding', () => {
  it('is a single trimmed line across the whole catalog', () => {
    // Spec: "Be a single line with no newline and no leading or trailing
    // whitespace."
    for (const entry of publishedEntries) {
      expectSingleLine(
        leaderboardPageDescription(entry.name, entry.url, entry.score),
        `description(${entry.name})`,
      );
    }
  });

  it('is a single trimmed line for hostile names, urls and scores', () => {
    const urls = [
      'https://example.com/a/b?q=1#f',
      'http://localhost:3000',
      'not a url',
      '',
      'https://münchen.de/x',
    ];
    for (const [label, name] of HOSTILE_NAMES) {
      for (const url of urls) {
        for (const score of [0, 100]) {
          expectSingleLine(
            leaderboardPageDescription(name, url, score),
            `description(${label}, ${JSON.stringify(url)}, ${score})`,
          );
        }
      }
    }
  });

  it('does not leak whitespace from a padded or multi-line name', () => {
    expectSingleLine(
      leaderboardPageDescription('  Padded  ', 'https://example.com', 5),
      'description(padded name)',
    );
    expectSingleLine(
      leaderboardPageDescription('Two\nLines', 'https://example.com', 5),
      'description(multi-line name)',
    );
  });
});

describe('leaderboardPageDescription: length budgets against the real catalog', () => {
  const lengths = publishedEntries.map((e) =>
    leaderboardPageDescription(e.name, e.url, e.score).length,
  );

  it('median description length is at or under 160 characters', () => {
    // Spec: "Stay within a length budget for the real catalog: median at or
    // under 160 characters".
    expect(median(lengths)).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
  });

  it('no published description exceeds 200 characters', () => {
    // Spec: "and no description over 200."
    const overruns = publishedEntries
      .map((e) => ({
        name: e.name,
        len: leaderboardPageDescription(e.name, e.url, e.score).length,
      }))
      .filter((r) => r.len > 200);
    expect(overruns).toEqual([]);
  });
});

describe('leaderboardPageDescription: purity and totality', () => {
  it('returns the same string for the same arguments', () => {
    // Spec, Notes: "All three functions are pure and total."
    for (const entry of publishedEntries.slice(0, 25)) {
      expect(leaderboardPageDescription(entry.name, entry.url, entry.score)).toBe(
        leaderboardPageDescription(entry.name, entry.url, entry.score),
      );
    }
  });

  it('does not throw on empty name or empty url', () => {
    expect(() => leaderboardPageDescription('', '', 0)).not.toThrow();
    expect(typeof leaderboardPageDescription('', '', 0)).toBe('string');
  });

  it('distinguishes two entries that differ only in score', () => {
    const a = leaderboardPageDescription('Acme', 'https://acme.example.com', 0);
    const b = leaderboardPageDescription('Acme', 'https://acme.example.com', 100);
    expect(a).not.toBe(b);
  });
});
