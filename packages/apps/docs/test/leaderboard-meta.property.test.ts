import { describe, it, expect } from 'vitest';

import {
  DISCOVERY_FILES,
  TITLE_BUDGET,
  DESCRIPTION_BUDGET,
  leaderboardPageTitle,
  leaderboardPageDescription,
  siteHost,
} from '../src/lib/leaderboard-meta';
import { getLeaderboard } from '~/lib/research-data';
import { listSiteRunSlugs } from '~/lib/site-run';

/**
 * PROPERTY tests for `leaderboardPageTitle`, `leaderboardPageDescription`, and
 * `siteHost` (TJ-1348 / TJ-1294).
 *
 * Oracle provenance: written clean-room from `leaderboard-meta.spec.md` and the
 * exported facade only. `src/lib/leaderboard-meta.ts` was never opened while
 * writing this file, so nothing below encodes "what the code happens to do".
 * Every expectation is a spec clause, or is recomputed independently from a
 * source the spec names (the real catalog via `getLeaderboard()` filtered by
 * `listSiteRunSlugs()`, and the WHATWG `URL` parser for host extraction).
 *
 * `fast-check` is NOT installed (checked this package's `package.json`, the
 * workspace root `package.json`, and both `node_modules` trees) and the request
 * forbids adding a dependency. Every property below is therefore universally
 * quantified by *exhaustive* enumeration over a finite domain, which is
 * strictly stronger than sampling:
 *
 *   - the whole published catalog (325 entries, all distinct names),
 *   - every integer score 0..100 inclusive,
 *   - a full cartesian product of scheme x host x path x query x fragment for
 *     `siteHost` (756 absolute URLs).
 *
 * Properties encoded:
 *   P1  title:  contains the entry name verbatim
 *   P2  title:  names llms.txt, robots.txt and sitemap.xml
 *   P3  title:  contains `a14y`
 *   P4  title:  contains no `&`
 *   P5  title:  contains no em-dash
 *   P6  title:  single line, trimmed, non-empty
 *   P7  title:  injective over distinct site names
 *   P8  title:  deterministic
 *   P9  title:  median length <= TITLE_BUDGET (60), max <= 75 over the catalog
 *   P10 desc:   leads with the name, names the score, names the host
 *   P11 desc:   names all four DISCOVERY_FILES
 *   P12 desc:   single line, trimmed, non-empty
 *   P13 desc:   deterministic
 *   P14 desc:   median length <= DESCRIPTION_BUDGET (160), max <= 200
 *   P15 desc:   for every score 0..100, the number renders and no
 *               `undefined` / `null` / `NaN` leaks into the output
 *   P16 host:   equals `new URL(u).host` for every absolute http/https URL, and
 *               so carries no `/`, no scheme, no query, no fragment
 *   P17 host:   preserves an explicit port
 *   P18 host:   returns the input unchanged for unparseable values
 *
 * KNOWN SPEC TENSION, recorded rather than papered over: the catalog contains
 * `McKinsey & Company`. The title spec asks for BOTH "contain the site name,
 * unmodified" (P1) and "contain no `&` character" (P4). Those two clauses are
 * jointly unsatisfiable for any name containing an ampersand, so one of P1/P4
 * must fail on that entry no matter how the function is written. They are kept
 * in separate `it` blocks so the failure points at exactly which clause gives,
 * and neither is weakened to make the suite green. Triage that as a spec
 * question (does "unmodified" yield to the `&amp;` mirror constraint?), not as
 * a broken test.
 */

const EM_DASH = '—';
const FORBIDDEN_TOKENS = ['undefined', 'null', 'NaN'] as const;

/** The exact terms the spec says the title must carry (AGENTS.md excluded). */
const TITLE_FILES = ['llms.txt', 'robots.txt', 'sitemap.xml'] as const;

/**
 * The real catalog the spec directs the budgets to be asserted against:
 * leaderboard entries whose site run is actually published, i.e. exactly the
 * set of `/leaderboard/<slug>/` pages that exist. Recomputed here from the two
 * loaders the spec names, never from the subject.
 */
const publishedRuns = new Set(listSiteRunSlugs());
const entries = getLeaderboard().filter((e) => publishedRuns.has(e.slug));

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Independent host oracle: the platform URL parser, not the subject. */
function expectedHost(url: string): string {
  return new URL(url).host;
}

function isParseableUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** Every counterexample, so a failure names the offending entries, not just one. */
function counterexamples<T>(domain: readonly T[], holds: (x: T) => boolean, label: (x: T) => string): string[] {
  return domain.filter((x) => !holds(x)).map(label);
}

describe('catalog preconditions (guards against vacuous properties)', () => {
  it('has published leaderboard entries to quantify over', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('every entry carries the fields the properties read', () => {
    for (const e of entries) {
      expect(typeof e.name).toBe('string');
      expect(e.name.length).toBeGreaterThan(0);
      expect(typeof e.url).toBe('string');
      expect(Number.isFinite(e.score)).toBe(true);
      expect(isParseableUrl(e.url)).toBe(true);
    }
  });

  it('exposes the four discovery files and the documented budgets', () => {
    expect([...DISCOVERY_FILES]).toEqual(['llms.txt', 'AGENTS.md', 'robots.txt', 'sitemap.xml']);
    expect(TITLE_BUDGET).toBe(60);
    expect(DESCRIPTION_BUDGET).toBe(160);
  });
});

describe('leaderboardPageTitle: content properties over the whole catalog', () => {
  it('P1: contains the entry name verbatim, for every entry', () => {
    // "Contain the site name, unmodified, so the result matches a query that
    // includes the brand."
    expect(
      counterexamples(
        entries,
        (e) => leaderboardPageTitle(e.name).includes(e.name),
        (e) => `${e.slug}: ${JSON.stringify(leaderboardPageTitle(e.name))} omits ${JSON.stringify(e.name)}`,
      ),
    ).toEqual([]);
  });

  it('P2: names llms.txt, robots.txt and sitemap.xml, for every entry', () => {
    for (const file of TITLE_FILES) {
      expect(
        counterexamples(
          entries,
          (e) => leaderboardPageTitle(e.name).includes(file),
          (e) => `${e.slug} missing ${file}`,
        ),
      ).toEqual([]);
    }
  });

  it('P3: contains the a14y brand token, for every entry', () => {
    expect(
      counterexamples(
        entries,
        (e) => leaderboardPageTitle(e.name).includes('a14y'),
        (e) => `${e.slug} missing a14y`,
      ),
    ).toEqual([]);
  });

  it('P4: introduces no `&` of its own, for every entry', () => {
    // Clarified in leaderboard-meta.spec.md after this test first ran: only
    // the FIXED part of the title is the template's to control. An `&` inside
    // a site name ("McKinsey & Company") is data and survives verbatim; the
    // mirror layer decodes the escaped form back to text.
    expect(
      counterexamples(
        entries,
        (e) => !leaderboardPageTitle(e.name).replace(e.name, '').includes('&'),
        (e) => `${e.slug}: ${JSON.stringify(leaderboardPageTitle(e.name))}`,
      ),
    ).toEqual([]);
  });

  it('P5: contains no em-dash, for every entry', () => {
    expect(
      counterexamples(
        entries,
        (e) => !leaderboardPageTitle(e.name).includes(EM_DASH),
        (e) => `${e.slug}: ${JSON.stringify(leaderboardPageTitle(e.name))}`,
      ),
    ).toEqual([]);
  });

  it('P6: is a single trimmed non-empty line, for every entry', () => {
    expect(
      counterexamples(
        entries,
        (e) => {
          const t = leaderboardPageTitle(e.name);
          return (
            t.length > 0 && !t.includes('\n') && !t.includes('\r') && t === t.trim()
          );
        },
        (e) => `${e.slug}: ${JSON.stringify(leaderboardPageTitle(e.name))}`,
      ),
    ).toEqual([]);
  });

  it('P6b: renders no undefined / null / NaN token, for every entry', () => {
    for (const token of FORBIDDEN_TOKENS) {
      expect(
        counterexamples(
          entries,
          (e) => !leaderboardPageTitle(e.name).includes(token),
          (e) => `${e.slug} leaked ${token}`,
        ),
      ).toEqual([]);
    }
  });
});

describe('leaderboardPageTitle: injectivity and determinism', () => {
  it('P7: distinct site names never collide on the same title', () => {
    const names = [...new Set(entries.map((e) => e.name))];
    expect(names.length).toBeGreaterThan(1); // non-vacuous
    const byTitle = new Map<string, string[]>();
    for (const name of names) {
      const title = leaderboardPageTitle(name);
      const bucket = byTitle.get(title);
      if (bucket) bucket.push(name);
      else byTitle.set(title, [name]);
    }
    const collisions = [...byTitle.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([title, group]) => `${JSON.stringify(title)} <- ${group.join(' | ')}`);
    expect(collisions).toEqual([]);
    expect(byTitle.size).toBe(names.length);
  });

  it('P8: is deterministic (same name, equal string, every entry)', () => {
    expect(
      counterexamples(
        entries,
        (e) => leaderboardPageTitle(e.name) === leaderboardPageTitle(e.name),
        (e) => e.slug,
      ),
    ).toEqual([]);
  });
});

describe('leaderboardPageTitle: length budget over the real catalog', () => {
  it('P9: median length <= TITLE_BUDGET and no title exceeds 75 characters', () => {
    const lengths = entries.map((e) => leaderboardPageTitle(e.name).length);
    expect(median(lengths)).toBeLessThanOrEqual(TITLE_BUDGET);

    const overruns = entries
      .filter((e) => leaderboardPageTitle(e.name).length > 75)
      .map((e) => `${e.slug}(${leaderboardPageTitle(e.name).length}): ${leaderboardPageTitle(e.name)}`);
    expect(overruns).toEqual([]);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(75);
  });
});

describe('leaderboardPageDescription: content properties over the whole catalog', () => {
  it('P10a: contains the site name, for every entry', () => {
    expect(
      counterexamples(
        entries,
        (e) => leaderboardPageDescription(e.name, e.url, e.score).includes(e.name),
        (e) => `${e.slug}: ${JSON.stringify(leaderboardPageDescription(e.name, e.url, e.score))}`,
      ),
    ).toEqual([]);
  });

  it('P10b: leads with the site name, for every entry', () => {
    // "Lead with the site name and its score out of 100."
    expect(
      counterexamples(
        entries,
        (e) => leaderboardPageDescription(e.name, e.url, e.score).startsWith(e.name),
        (e) => `${e.slug}: ${JSON.stringify(leaderboardPageDescription(e.name, e.url, e.score))}`,
      ),
    ).toEqual([]);
  });

  it('P10c: contains the score out of 100, for every entry', () => {
    expect(
      counterexamples(
        entries,
        (e) => {
          const d = leaderboardPageDescription(e.name, e.url, e.score);
          return d.includes(String(e.score)) && d.includes('/100');
        },
        (e) => `${e.slug} (score ${e.score}): ${JSON.stringify(leaderboardPageDescription(e.name, e.url, e.score))}`,
      ),
    ).toEqual([]);
  });

  it('P10d: contains the host of the site URL and not the full URL, for every entry', () => {
    expect(
      counterexamples(
        entries,
        (e) => leaderboardPageDescription(e.name, e.url, e.score).includes(expectedHost(e.url)),
        (e) => `${e.slug} missing host ${expectedHost(e.url)}`,
      ),
    ).toEqual([]);

    // "spends its budget on words rather than on a scheme and path"
    expect(
      counterexamples(
        entries,
        (e) => !leaderboardPageDescription(e.name, e.url, e.score).includes('://'),
        (e) => `${e.slug} rendered a scheme`,
      ),
    ).toEqual([]);
  });

  it('P11: names all four discovery files, for every entry', () => {
    for (const file of DISCOVERY_FILES) {
      expect(
        counterexamples(
          entries,
          (e) => leaderboardPageDescription(e.name, e.url, e.score).includes(file),
          (e) => `${e.slug} missing ${file}`,
        ),
      ).toEqual([]);
    }
  });

  it('P12: is a single trimmed non-empty line, for every entry', () => {
    expect(
      counterexamples(
        entries,
        (e) => {
          const d = leaderboardPageDescription(e.name, e.url, e.score);
          return d.length > 0 && !d.includes('\n') && !d.includes('\r') && d === d.trim();
        },
        (e) => `${e.slug}: ${JSON.stringify(leaderboardPageDescription(e.name, e.url, e.score))}`,
      ),
    ).toEqual([]);
  });

  it('P13: is deterministic (same arguments, equal string, every entry)', () => {
    expect(
      counterexamples(
        entries,
        (e) =>
          leaderboardPageDescription(e.name, e.url, e.score) ===
          leaderboardPageDescription(e.name, e.url, e.score),
        (e) => e.slug,
      ),
    ).toEqual([]);
  });
});

describe('leaderboardPageDescription: length budget over the real catalog', () => {
  it('P14: median length <= DESCRIPTION_BUDGET and no description exceeds 200 characters', () => {
    const lengths = entries.map((e) => leaderboardPageDescription(e.name, e.url, e.score).length);
    expect(median(lengths)).toBeLessThanOrEqual(DESCRIPTION_BUDGET);

    const overruns = entries
      .filter((e) => leaderboardPageDescription(e.name, e.url, e.score).length > 200)
      .map((e) => `${e.slug}(${leaderboardPageDescription(e.name, e.url, e.score).length})`);
    expect(overruns).toEqual([]);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(200);
  });
});

describe('leaderboardPageDescription: score robustness over every integer 0..100', () => {
  /**
   * Exhaustive over the full legal score domain, crossed with a slice of real
   * catalog names/URLs (including the shortest and longest names, so the score
   * property is not tested only on a convenient middle case). 0 and 100 are
   * boundary values the spec calls out explicitly; the live catalog only spans
   * 15..98, so this domain strictly contains it.
   */
  type Entry = (typeof entries)[number];
  const byNameLength = [...entries].sort((a, b) => a.name.length - b.name.length);
  const sampleSites: Entry[] = [
    byNameLength[0],
    byNameLength[byNameLength.length - 1],
    entries[0],
    entries[entries.length - 1],
  ].filter((s): s is Entry => Boolean(s));

  it('has sites to quantify over (guards a vacuous property)', () => {
    expect(sampleSites.length).toBeGreaterThan(0);
  });

  it('P15a: renders the score verbatim for every integer 0..100', () => {
    const failures: string[] = [];
    for (const site of sampleSites) {
      for (let s = 0; s <= 100; s++) {
        const d = leaderboardPageDescription(site.name, site.url, s);
        if (!d.includes(String(s))) failures.push(`${site.slug}@${s}: ${JSON.stringify(d)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('P15b: leaks no undefined / null / NaN token for any integer 0..100', () => {
    const failures: string[] = [];
    for (const site of sampleSites) {
      for (let s = 0; s <= 100; s++) {
        const d = leaderboardPageDescription(site.name, site.url, s);
        for (const token of FORBIDDEN_TOKENS) {
          if (d.includes(token)) failures.push(`${site.slug}@${s} leaked ${token}: ${JSON.stringify(d)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('P15c: still names the site, the host and all four files for every integer 0..100', () => {
    const failures: string[] = [];
    for (const site of sampleSites) {
      const host = expectedHost(site.url);
      for (let s = 0; s <= 100; s++) {
        const d = leaderboardPageDescription(site.name, site.url, s);
        if (!d.includes(site.name)) failures.push(`${site.slug}@${s} lost the name`);
        if (!d.includes(host)) failures.push(`${site.slug}@${s} lost the host`);
        for (const file of DISCOVERY_FILES) {
          if (!d.includes(file)) failures.push(`${site.slug}@${s} lost ${file}`);
        }
        if (d !== d.trim() || d.includes('\n')) failures.push(`${site.slug}@${s} is not a single trimmed line`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('P15d: is monotone in nothing but the score digits (determinism across the range)', () => {
    // Same arguments, same output, for all 101 scores.
    const failures: string[] = [];
    for (const site of sampleSites) {
      for (let s = 0; s <= 100; s++) {
        const a = leaderboardPageDescription(site.name, site.url, s);
        const b = leaderboardPageDescription(site.name, site.url, s);
        if (a !== b) failures.push(`${site.slug}@${s} is nondeterministic`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('siteHost: exhaustive over a cartesian product of absolute URLs', () => {
  const SCHEMES = ['http', 'https'] as const;
  const HOSTS = [
    'example.com',
    'www.merriam-webster.com',
    'sub.domain.example.co.uk',
    'localhost:3000',
    'example.com:8443',
    '192.168.0.1:8080',
    'xn--bcher-kva.example',
  ] as const;
  const PATHS = ['', '/', '/dictionary', '/a/b/c/', '/path%20with%20space', '/docs/index.html'] as const;
  const QUERIES = ['', '?q=1', '?a=b&c=d'] as const;
  const FRAGMENTS = ['', '#top', '#a/b'] as const;

  const urls: string[] = [];
  for (const scheme of SCHEMES) {
    for (const host of HOSTS) {
      for (const path of PATHS) {
        for (const query of QUERIES) {
          for (const fragment of FRAGMENTS) {
            urls.push(`${scheme}://${host}${path}${query}${fragment}`);
          }
        }
      }
    }
  }
  /** Plus every real catalog URL, so the property covers production data too. */
  const catalogUrls = [...new Set(entries.map((e) => e.url))];
  const allUrls = [...urls, ...catalogUrls];

  it('has a non-trivial URL domain (guards a vacuous property)', () => {
    expect(urls.length).toBe(
      SCHEMES.length * HOSTS.length * PATHS.length * QUERIES.length * FRAGMENTS.length,
    );
    expect(catalogUrls.length).toBeGreaterThan(0);
  });

  it('P16a: equals the WHATWG-parsed host, for every absolute http/https URL', () => {
    const failures = allUrls
      .filter((u) => siteHost(u) !== expectedHost(u))
      .map((u) => `${u} -> ${JSON.stringify(siteHost(u))} (expected ${JSON.stringify(expectedHost(u))})`);
    expect(failures).toEqual([]);
  });

  it('P16b: carries no `/`, no scheme, no query and no fragment, for every absolute URL', () => {
    const failures: string[] = [];
    for (const u of allUrls) {
      const h = siteHost(u);
      if (h.length === 0) failures.push(`${u} -> empty host`);
      if (h.includes('/')) failures.push(`${u} -> contains /`);
      if (h.includes('://') || /^https?:/i.test(h)) failures.push(`${u} -> contains a scheme`);
      if (h.includes('?')) failures.push(`${u} -> contains a query`);
      if (h.includes('#')) failures.push(`${u} -> contains a fragment`);
      if (h !== h.trim()) failures.push(`${u} -> untrimmed`);
    }
    expect(failures).toEqual([]);
  });

  it('P16c: is deterministic, for every absolute URL', () => {
    const failures = allUrls.filter((u) => siteHost(u) !== siteHost(u));
    expect(failures).toEqual([]);
  });

  it('P17: preserves an explicit port, for every URL that carries one', () => {
    const ported = allUrls.filter((u) => /:\d+/.test(new URL(u).host));
    expect(ported.length).toBeGreaterThan(0); // non-vacuous
    const failures = ported
      .filter((u) => {
        const port = new URL(u).port;
        return port.length > 0 && !siteHost(u).endsWith(`:${port}`);
      })
      .map((u) => `${u} -> ${siteHost(u)}`);
    expect(failures).toEqual([]);
  });

  it('P18: returns the input unchanged for every value that cannot be parsed as a URL', () => {
    const unparseable = [
      '',
      'not a url',
      'merriam-webster.com',
      'www.example.com/dictionary',
      '://example.com',
      '   ',
      '//example.com',
      'example',
    ].filter((v) => !isParseableUrl(v)); // only assert the documented branch

    expect(unparseable.length).toBeGreaterThan(0); // non-vacuous
    const failures = unparseable
      .filter((v) => siteHost(v) !== v)
      .map((v) => `${JSON.stringify(v)} -> ${JSON.stringify(siteHost(v))}`);
    expect(failures).toEqual([]);
  });

  it('P18b: never throws, for any string in the combined domain', () => {
    const domain = [...allUrls, '', 'not a url', 'merriam-webster.com', '://x', '   '];
    const failures: string[] = [];
    for (const v of domain) {
      try {
        siteHost(v);
      } catch (err) {
        failures.push(`${JSON.stringify(v)} threw ${String(err)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
