/**
 * Adversarial + property tests for `buildSiteNarrative(run, siteName)`.
 *
 * Oracle source: `src/lib/site-narrative.spec.md` (authored from TJ-1430 intent).
 * The implementation file `src/lib/site-narrative.ts` was NOT read while
 * writing these tests. Every expectation is derived from the spec's promises
 * and recomputed independently from the `SiteRun` fixtures constructed here,
 * so nothing asserts "what the code currently does".
 *
 * `SiteRun` is shaped as the spec's Notes describe:
 *   { summary: { score, passed, applicable }, scorecardVersion,
 *     pages: [...], siteChecks: [{ id, status }] }
 * `pages` only needs the right `.length`; `siteChecks` entries need `id` and
 * a `status` of pass|fail|warn|error|na.
 */
import { describe, expect, it } from 'vitest';

import { buildSiteNarrative } from '../src/lib/site-narrative';

// ---------------------------------------------------------------------------
// Fixture builders (independent of the implementation)
// ---------------------------------------------------------------------------

type Status = 'pass' | 'fail' | 'warn' | 'error' | 'na';

interface SiteCheck {
  id: string;
  status: Status;
}

interface RunOpts {
  score?: number;
  passed?: number;
  applicable?: number;
  scorecardVersion?: string;
  pageCount?: number;
  /** id -> status, becomes run.siteChecks */
  checks?: Record<string, Status>;
}

function makeRun(opts: RunOpts = {}) {
  const {
    score = 50,
    passed = 1,
    applicable = 2,
    scorecardVersion = 'v0.2.0',
    pageCount = 1,
    checks = {},
  } = opts;
  const siteChecks: SiteCheck[] = Object.entries(checks).map(([id, status]) => ({
    id,
    status,
  }));
  return {
    summary: { score, passed, applicable },
    scorecardVersion,
    pages: Array.from({ length: pageCount }, () => ({})),
    siteChecks,
  };
}

// The four discovery surfaces, in the spec's stated order, with the exact
// labels the spec names for each.
const EXISTS_IDS = ['llms-txt.exists', 'agents-md.exists', 'sitemap-xml.exists', 'sitemap-md.exists'] as const;
const LABEL_LLMS = 'llms.txt';
const LABEL_AGENTS = 'AGENTS.md';

/** Oxford-style list join, recomputed independently from the spec's rules. */
function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** Invariants every returned sentence must satisfy, per the spec's Should. */
function assertSentenceHygiene(sentences: string[]) {
  for (const s of sentences) {
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
    expect(s.trim()).not.toBe('');
    expect(s.endsWith('.')).toBe(true);
    for (const artifact of ['undefined', 'NaN', '${', '[object Object]']) {
      expect(s.includes(artifact), `sentence contains "${artifact}": ${JSON.stringify(s)}`).toBe(false);
    }
    // List/grammar hygiene: no doubled spaces, no space-before-comma, no
    // doubled commas, no dangling comma at a boundary.
    expect(s).not.toMatch(/ {2,}/);
    expect(s).not.toMatch(/ ,/);
    expect(s).not.toMatch(/,,/);
    expect(s).not.toMatch(/,\./); // ", ." style trailing comma
    expect(s.trimStart().startsWith(',')).toBe(false);
  }
}

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

describe('buildSiteNarrative — shape', () => {
  it('always returns 2 or 3 non-empty sentences ending in a period', () => {
    // Sweep exists combinations, valid states, page counts and scores; every
    // result must obey the shape invariants regardless of input.
    for (let mask = 0; mask < 16; mask++) {
      for (const validState of ['none', 'pass', 'fail'] as const) {
        for (const pageCount of [0, 1, 5]) {
          const checks: Record<string, Status> = {};
          EXISTS_IDS.forEach((id, i) => {
            // eslint-disable-next-line no-bitwise
            checks[id] = (mask & (1 << i)) ? 'pass' : 'fail';
          });
          if (validState !== 'none') checks['sitemap-xml.valid'] = validState;
          const out = buildSiteNarrative(
            makeRun({ score: 42, passed: 1, applicable: 3, pageCount, checks }),
            'Example Site',
          );
          expect(Array.isArray(out)).toBe(true);
          expect(out.length).toBeGreaterThanOrEqual(2);
          expect(out.length).toBeLessThanOrEqual(3);
          assertSentenceHygiene(out);
        }
      }
    }
  });

  it('omits sentence 3 (length 2) when none of the four *.exists checks are present', () => {
    // No site checks at all.
    expect(buildSiteNarrative(makeRun({ checks: {} }), 'Example').length).toBe(2);
    // Site checks present, but none are one of the four discovery *.exists ids.
    const unrelated = makeRun({
      checks: { 'some-other.exists': 'pass', 'sitemap-xml.valid': 'pass' },
    });
    expect(buildSiteNarrative(unrelated, 'Example').length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Sentence 1 — score line
// ---------------------------------------------------------------------------

describe('buildSiteNarrative — sentence 1 (score)', () => {
  it('names the site, the verbatim score, "out of 100", and the version', () => {
    const cases = [
      { score: 42, version: 'v0.2.0', name: 'Alpha Docs' },
      { score: 88, version: 'v9.9.9-draft', name: 'Beta Portal' },
    ];
    for (const c of cases) {
      const [s1] = buildSiteNarrative(
        makeRun({ score: c.score, scorecardVersion: c.version }),
        c.name,
      );
      expect(s1).toContain(c.name);
      expect(s1).toMatch(new RegExp(`\\b${c.score}\\b`));
      expect(s1).toContain('out of 100');
      expect(s1).toContain(c.version);
    }
  });

  it('uses the score from the run, not a constant', () => {
    const a = buildSiteNarrative(makeRun({ score: 7 }), 'Site')[0];
    const b = buildSiteNarrative(makeRun({ score: 63 }), 'Site')[0];
    expect(a).toMatch(/\b7\b/);
    expect(b).toMatch(/\b63\b/);
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Sentence 2 — coverage & pass rate
// ---------------------------------------------------------------------------

describe('buildSiteNarrative — sentence 2 (coverage)', () => {
  it('says a single page (never "1 pages") when pages.length === 1', () => {
    const s2 = buildSiteNarrative(makeRun({ pageCount: 1, passed: 1, applicable: 2 }), 'Site')[1];
    expect(s2).toContain('single page');
    expect(s2).not.toMatch(/\b1 pages\b/);
  });

  it('states the page count when pages.length > 1', () => {
    const s2 = buildSiteNarrative(makeRun({ pageCount: 7, passed: 1, applicable: 2 }), 'Site')[1];
    expect(s2).toMatch(/\b7\b/);
    expect(s2).toMatch(/pages/);
    expect(s2).not.toContain('single page');
  });

  it('asserts no pass percentage when pages.length === 0', () => {
    const s2 = buildSiteNarrative(makeRun({ pageCount: 0, passed: 0, applicable: 0 }), 'Site')[1];
    expect(s2).not.toContain('%');
    expect(s2).not.toContain('NaN');
  });

  it('includes round(100*passed/applicable)% whenever at least one page exists', () => {
    // Independently recomputed; chosen so the rounding actually bites.
    const cases = [
      { passed: 1, applicable: 3, pct: 33 },
      { passed: 2, applicable: 3, pct: 67 },
      { passed: 1, applicable: 2, pct: 50 },
      { passed: 5, applicable: 5, pct: 100 },
    ];
    for (const c of cases) {
      expect(Math.round((100 * c.passed) / c.applicable)).toBe(c.pct); // guard the fixture
      const s2 = buildSiteNarrative(
        makeRun({ pageCount: 3, passed: c.passed, applicable: c.applicable }),
        'Site',
      )[1];
      expect(s2, `expected ${c.pct}% for ${c.passed}/${c.applicable}`).toContain(`${c.pct}%`);
      expect(s2).not.toContain('NaN');
    }
  });

  it('yields 0% (never NaN) when applicable === 0 but pages exist', () => {
    const s2 = buildSiteNarrative(makeRun({ pageCount: 3, passed: 0, applicable: 0 }), 'Site')[1];
    expect(s2).toContain('0%');
    expect(s2).not.toContain('NaN');
    expect(s2).not.toContain('undefined');
  });
});

// ---------------------------------------------------------------------------
// Sentence 3 — discovery surfaces
// ---------------------------------------------------------------------------

describe('buildSiteNarrative — sentence 3 (discovery)', () => {
  const allExist = (status: Status): Record<string, Status> =>
    Object.fromEntries(EXISTS_IDS.map((id) => [id, status]));

  it('lists all four and asserts nothing absent when every surface is published', () => {
    const out = buildSiteNarrative(makeRun({ checks: allExist('pass') }), 'Site');
    expect(out.length).toBe(3);
    const s3 = out[2];
    expect(s3).toContain(LABEL_LLMS);
    expect(s3).toContain(LABEL_AGENTS);
    expect(s3).toContain('XML sitemap');
    expect(s3).toContain('sitemap'); // markdown sitemap present too
    expect(s3.toLowerCase()).not.toContain('absent');
  });

  it('says the site publishes none and lists all four as absent when none published', () => {
    const out = buildSiteNarrative(makeRun({ checks: allExist('fail') }), 'Site');
    expect(out.length).toBe(3);
    const s3 = out[2];
    // Spec: "says the site publishes none of them and lists the absent
    // surfaces." The required signal is "none"; the surfaces are then listed.
    // (The literal token "absent" is only mandated in the mixed case.)
    expect(s3.toLowerCase()).toContain('none');
    expect(s3).toContain(LABEL_LLMS);
    expect(s3).toContain(LABEL_AGENTS);
    expect(s3).toContain('XML sitemap');
  });

  it('treats a present-but-failing *.exists as absent', () => {
    // Only two surfaces evaluated: llms published, agents present-but-fail.
    const out = buildSiteNarrative(
      makeRun({ checks: { 'llms-txt.exists': 'pass', 'agents-md.exists': 'fail' } }),
      'Site',
    );
    expect(out.length).toBe(3);
    const s3 = out[2];
    expect(s3).toContain(LABEL_LLMS);
    expect(s3).toContain(LABEL_AGENTS);
    expect(s3).toMatch(/\bis absent\b/); // exactly one absent -> singular
    // Surfaces whose *.exists is not in siteChecks are not mentioned.
    expect(s3).not.toContain('XML');
    expect(s3.toLowerCase()).not.toContain('markdown');
  });

  it('treats non-pass statuses (warn/error/na) as not published', () => {
    for (const status of ['warn', 'error', 'na'] as Status[]) {
      const out = buildSiteNarrative(
        makeRun({ checks: { 'llms-txt.exists': status } }),
        'Site',
      );
      expect(out.length).toBe(3);
      // Only surface evaluated is not published (status is not `pass`), so the
      // site "publishes none" of the evaluated surfaces.
      expect(out[2].toLowerCase()).toContain('none');
      expect(out[2]).toContain(LABEL_LLMS);
    }
  });

  it('mentions only the surfaces whose *.exists check is present', () => {
    // Only llms + agents evaluated, both published -> nothing absent, and the
    // two sitemap surfaces are never named.
    const out = buildSiteNarrative(
      makeRun({ checks: { 'llms-txt.exists': 'pass', 'agents-md.exists': 'pass' } }),
      'Site',
    );
    expect(out.length).toBe(3);
    const s3 = out[2];
    expect(s3).toContain(LABEL_LLMS);
    expect(s3).toContain(LABEL_AGENTS);
    expect(s3).not.toContain('XML');
    expect(s3.toLowerCase()).not.toContain('markdown');
    expect(s3.toLowerCase()).not.toContain('absent');
  });

  it('uses "are absent" for multiple absent surfaces and "is absent" for one', () => {
    // Two published (llms, agents), two absent (xml, md) -> plural.
    const twoAbsent = buildSiteNarrative(
      makeRun({
        checks: {
          'llms-txt.exists': 'pass',
          'agents-md.exists': 'pass',
          'sitemap-xml.exists': 'fail',
          'sitemap-md.exists': 'fail',
        },
      }),
      'Site',
    )[2];
    expect(twoAbsent).toMatch(/\bare absent\b/);
    expect(twoAbsent).not.toMatch(/\bis absent\b/);

    // Three published, one absent -> singular.
    const oneAbsent = buildSiteNarrative(
      makeRun({
        checks: {
          'llms-txt.exists': 'pass',
          'agents-md.exists': 'pass',
          'sitemap-xml.exists': 'pass',
          'sitemap-md.exists': 'fail',
        },
      }),
      'Site',
    )[2];
    expect(oneAbsent).toMatch(/\bis absent\b/);
    expect(oneAbsent).not.toMatch(/\bare absent\b/);
  });
});

// ---------------------------------------------------------------------------
// XML sitemap validity wording
// ---------------------------------------------------------------------------

describe('buildSiteNarrative — XML sitemap validity', () => {
  it('says "a valid XML sitemap" only when exists=pass AND valid=pass', () => {
    const s3 = buildSiteNarrative(
      makeRun({ checks: { 'sitemap-xml.exists': 'pass', 'sitemap-xml.valid': 'pass' } }),
      'Site',
    )[2];
    expect(s3).toContain('valid XML sitemap');
  });

  it('says "an XML sitemap" (no "valid") when published but valid check is missing', () => {
    const s3 = buildSiteNarrative(
      makeRun({ checks: { 'sitemap-xml.exists': 'pass' } }),
      'Site',
    )[2];
    expect(s3).toContain('XML sitemap');
    expect(s3).not.toContain('valid');
  });

  it('says "an XML sitemap" (no "valid") when published but valid check fails', () => {
    const s3 = buildSiteNarrative(
      makeRun({ checks: { 'sitemap-xml.exists': 'pass', 'sitemap-xml.valid': 'fail' } }),
      'Site',
    )[2];
    expect(s3).toContain('XML sitemap');
    expect(s3).not.toContain('valid');
  });

  it('never applies the validity wording to an absent XML sitemap, even if valid=pass', () => {
    const s3 = buildSiteNarrative(
      makeRun({ checks: { 'sitemap-xml.exists': 'fail', 'sitemap-xml.valid': 'pass' } }),
      'Site',
    )[2];
    expect(s3).not.toContain('valid XML sitemap');
    expect(s3).not.toContain('valid');
  });
});

// ---------------------------------------------------------------------------
// List grammar (Oxford)
// ---------------------------------------------------------------------------

describe('buildSiteNarrative — list grammar', () => {
  it('joins two published surfaces with " and " and no comma', () => {
    const s3 = buildSiteNarrative(
      makeRun({ checks: { 'llms-txt.exists': 'pass', 'agents-md.exists': 'pass' } }),
      'Site',
    )[2];
    expect(s3).toContain(joinList([LABEL_LLMS, LABEL_AGENTS])); // "llms.txt and AGENTS.md"
    // The two names must not be comma-separated.
    expect(s3).not.toContain(`${LABEL_LLMS}, ${LABEL_AGENTS}`);
  });

  it('joins three published surfaces with commas and a final ", and "', () => {
    // llms, agents, xml published (xml with no valid check -> "an XML sitemap");
    // markdown absent.
    const s3 = buildSiteNarrative(
      makeRun({
        checks: {
          'llms-txt.exists': 'pass',
          'agents-md.exists': 'pass',
          'sitemap-xml.exists': 'pass',
          'sitemap-md.exists': 'fail',
        },
      }),
      'Site',
    )[2];
    // Independently reconstructed published-list join for the first two labels
    // plus the Oxford comma before the third.
    expect(s3).toContain(`${LABEL_LLMS}, ${LABEL_AGENTS}, and `);
    expect(s3).toContain('XML sitemap');
  });
});

// ---------------------------------------------------------------------------
// Purity
// ---------------------------------------------------------------------------

describe('buildSiteNarrative — purity', () => {
  it('returns deeply-equal output for repeated calls with the same run', () => {
    const run = makeRun({
      score: 71,
      passed: 2,
      applicable: 5,
      pageCount: 4,
      checks: {
        'llms-txt.exists': 'pass',
        'agents-md.exists': 'fail',
        'sitemap-xml.exists': 'pass',
        'sitemap-xml.valid': 'pass',
        'sitemap-md.exists': 'warn',
      },
    });
    expect(buildSiteNarrative(run, 'Repeat Site')).toEqual(buildSiteNarrative(run, 'Repeat Site'));
  });

  it('does not mutate the run object', () => {
    const run = makeRun({
      score: 33,
      passed: 1,
      applicable: 4,
      pageCount: 2,
      checks: { 'llms-txt.exists': 'pass', 'sitemap-xml.exists': 'fail' },
    });
    const before = JSON.parse(JSON.stringify(run));
    buildSiteNarrative(run, 'Immutable Site');
    expect(run).toEqual(before);
  });
});
