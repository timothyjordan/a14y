import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoveryFilesIntegration } from '../src/integrations/discovery-files';

/**
 * PROPERTY tests for `discoveryFilesIntegration()`.
 *
 * Oracle provenance: these assertions were authored clean-room from the
 * behavioral spec for `discoveryFilesIntegration` (TJ-1337 / TJ-1293) and the
 * exported facade only. Neither `src/integrations/discovery-files.ts` nor
 * `src/lib/site-routes.ts` was read while writing this file, so nothing below
 * encodes "what the code happens to do" -- only what the discovery files are
 * supposed to advertise.
 *
 * `fast-check` is NOT a dependency of this repo (checked the workspace root and
 * the package's own `node_modules`) and the spec forbids adding one. The unit
 * under test also takes no input to shrink: it is a nullary factory whose only
 * "input" is the site's own route table. The properties that matter are
 * therefore *internal* invariants over the finite set of emitted entries and
 * *relational* invariants between the three discovery files. Every property
 * below is universally quantified with an exhaustive
 * `for (const x of allEntries)` loop over that finite set -- several hundred
 * URLs per run -- rather than spot-checked on a hand-picked example.
 *
 * Properties encoded:
 *   P1  consistency        route set announced by sitemap.xml === route set
 *                          represented by sitemap.md
 *   P2  mirror correspondence  every `.md` link in sitemap.md / llms.txt is
 *                          `route -> mirror` of a real route, nothing outside
 *   P3  well-formedness    document parses as XML; every <loc> is a canonical
 *                          absolute https://a14y.dev URL, XML-escaped; every
 *                          <url> carries one <lastmod> in YYYY-MM-DD form
 *   P4  idempotence        two runs against the same publicDir are byte-identical
 *   P5  subset             llms.txt URLs subset of sitemap.xml routes (it
 *                          curates, it never invents)
 *   P6  no unexpanded `[param]` placeholder anywhere in any emitted file
 */

const ORIGIN = 'https://a14y.dev';

/**
 * The discovery files themselves are legitimate link targets that are not
 * site *routes* (llms.txt explicitly carries a full-sitemap pointer per the
 * spec). Everything else must resolve into the route set.
 */
const DISCOVERY_FILE_PATHS = new Set([
  '/llms.txt',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemap.md',
  '/AGENTS.md',
]);

/** Files the integration writes, per the facade (well-known surface excluded). */
const EMITTED_FILES = [
  'llms.txt',
  'robots.txt',
  'sitemap.xml',
  'sitemap.md',
  'AGENTS.md',
] as const;

// ---------------------------------------------------------------------------
// helpers (all oracle-side; none derived from the implementation)
// ---------------------------------------------------------------------------

/** Documented transform: `/foo/` -> `/foo.md`, `/` -> `/index.md`. */
function routeToMirror(route: string): string {
  if (route === '/') return '/index.md';
  return `${route.replace(/\/$/, '')}.md`;
}

/** Inverse of {@link routeToMirror}. Returns null for non-mirror paths. */
function mirrorToRoute(mirror: string): string | null {
  if (!mirror.endsWith('.md')) return null;
  const base = mirror.slice(0, -'.md'.length);
  if (base === '/index') return '/';
  if (!base.startsWith('/')) return null;
  return `${base}/`;
}

/**
 * Normalises a link target to a site-absolute path, or null when the link is
 * external / not a site link. Strips fragment and query.
 */
function internalPath(href: string): string | null {
  let h = href.trim();
  if (h.startsWith('<') && h.endsWith('>')) h = h.slice(1, -1);
  if (h.startsWith(`${ORIGIN}/`) || h === ORIGIN) {
    h = h.slice(ORIGIN.length) || '/';
  } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(h)) {
    return null; // absolute URL on some other origin (or mailto:, etc.)
  } else if (h.startsWith('//')) {
    return null; // protocol-relative -> another origin
  }
  if (!h.startsWith('/')) return null; // in-page anchor or relative link
  h = h.split('#')[0].split('?')[0];
  return h === '' ? '/' : h;
}

interface DocLink {
  label: string;
  target: string;
  line: number;
}

/** A {@link DocLink} whose target resolved to a site-absolute path. */
interface ResolvedLink extends DocLink {
  path: string;
}

/** All markdown inline links `[label](target)` in a document, in order. */
function markdownLinks(text: string): DocLink[] {
  const out: DocLink[] = [];
  const lines = text.split('\n');
  const re = /\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(re)) {
      out.push({ label: m[1], target: m[2], line: idx });
    }
  });
  return out;
}

function decodeXmlEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    }
    if (body.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    }
    switch (body) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        return whole;
    }
  });
}

const VALID_ENTITY = /^&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/;

/**
 * Minimal but strict XML well-formedness checker. Written here rather than
 * pulled from a parser package so the test adds no dependency and so the
 * escaping rules are asserted explicitly (a lenient HTML-ish parser would
 * happily swallow a raw `&`). Returns a list of human-readable violations;
 * empty means well-formed.
 */
function xmlWellFormednessErrors(xml: string): string[] {
  const errors: string[] = [];
  const stack: string[] = [];
  const nameRe = /^[A-Za-z_][A-Za-z0-9_.:-]*/;
  const attrsRe = /^(\s+[A-Za-z_:][A-Za-z0-9_.:-]*\s*=\s*("[^"<]*"|'[^'<]*'))*\s*$/;
  let rootCount = 0;
  let i = 0;

  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    const text = lt === -1 ? xml.slice(i) : xml.slice(i, lt);

    if (text.length > 0) {
      if (stack.length === 0 && text.trim() !== '') {
        errors.push(`character data outside the root element: ${JSON.stringify(text.slice(0, 40))}`);
      }
      for (let k = 0; k < text.length; k++) {
        if (text[k] === '&' && !VALID_ENTITY.test(text.slice(k))) {
          errors.push(`unescaped '&' in character data near ${JSON.stringify(text.slice(k, k + 24))}`);
        }
      }
    }
    if (lt === -1) break;

    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4);
      if (end === -1) {
        errors.push('unterminated comment');
        break;
      }
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9);
      if (end === -1) {
        errors.push('unterminated CDATA section');
        break;
      }
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt + 2);
      if (end === -1) {
        errors.push('unterminated processing instruction / XML declaration');
        break;
      }
      i = end + 2;
      continue;
    }
    if (xml.startsWith('<!', lt)) {
      const end = xml.indexOf('>', lt);
      if (end === -1) {
        errors.push('unterminated declaration');
        break;
      }
      i = end + 1;
      continue;
    }

    const gt = xml.indexOf('>', lt);
    if (gt === -1) {
      errors.push('unterminated tag');
      break;
    }
    const raw = xml.slice(lt + 1, gt);

    if (raw.startsWith('/')) {
      const name = raw.slice(1).trim();
      const top = stack.pop();
      if (top === undefined) {
        errors.push(`closing tag </${name}> with no open element`);
      } else if (top !== name) {
        errors.push(`mismatched closing tag </${name}> (expected </${top}>)`);
      }
    } else {
      const selfClosing = raw.endsWith('/');
      const body = selfClosing ? raw.slice(0, -1) : raw;
      const m = nameRe.exec(body);
      if (!m) {
        errors.push(`invalid element name in <${raw}>`);
      } else {
        const attrs = body.slice(m[0].length);
        if (!attrsRe.test(attrs)) {
          errors.push(`malformed attribute list in <${raw}>`);
        }
        if (stack.length === 0) rootCount++;
        if (!selfClosing) stack.push(m[0]);
      }
    }
    i = gt + 1;
  }

  if (stack.length > 0) errors.push(`unclosed element(s): ${stack.join(' > ')}`);
  if (rootCount !== 1) errors.push(`expected exactly 1 root element, found ${rootCount}`);
  return errors;
}

function isRealCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  );
}

async function readTree(dir: string, prefix = ''): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>();
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const abs = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      for (const [k, v] of await readTree(abs, rel)) out.set(k, v);
    } else if (entry.isFile()) {
      out.set(rel, await fs.readFile(abs));
    }
  }
  return out;
}

async function runIntegration(publicDir: string): Promise<void> {
  const integration = discoveryFilesIntegration();
  const setupHook = integration.hooks['astro:config:setup'];
  expect(typeof setupHook).toBe('function');
  await (setupHook as (args: unknown) => unknown | Promise<unknown>)({
    config: { publicDir: pathToFileURL(`${publicDir}/`) },
  });
}

// ---------------------------------------------------------------------------
// fixture: one run of the integration into a temp publicDir
// ---------------------------------------------------------------------------

interface SitemapUrlEntry {
  /** raw (still-escaped) text inside <loc> */
  rawLoc: string;
  /** entity-decoded <loc> */
  loc: string;
  /** raw text of every <lastmod> in this <url> block */
  lastmods: string[];
  /** how many <loc> children this <url> block had */
  locCount: number;
}

let tmp: string;
let publicDir: string;
let sitemapXml: string;
let sitemapMd: string;
let llmsTxt: string;
let robotsTxt: string;
let agentsMd: string;
let fileContents: Record<string, string>;

/** Every <url> entry in sitemap.xml. This is the finite set we quantify over. */
let urlEntries: SitemapUrlEntry[] = [];
/** Route pathnames announced by sitemap.xml -- the canonical route set. */
let routeSet: Set<string> = new Set();

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'a14y-discovery-prop-'));
  publicDir = path.join(tmp, 'public');
  await fs.mkdir(publicDir, { recursive: true });
  await runIntegration(publicDir);

  fileContents = {};
  for (const name of EMITTED_FILES) {
    fileContents[name] = await fs.readFile(path.join(publicDir, name), 'utf8');
  }
  sitemapXml = fileContents['sitemap.xml'];
  sitemapMd = fileContents['sitemap.md'];
  llmsTxt = fileContents['llms.txt'];
  robotsTxt = fileContents['robots.txt'];
  agentsMd = fileContents['AGENTS.md'];

  urlEntries = [...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
    const block = m[1];
    const locs = [...block.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((l) => l[1]);
    const lastmods = [...block.matchAll(/<lastmod>([\s\S]*?)<\/lastmod>/g)].map((l) => l[1]);
    const rawLoc = locs[0] ?? '';
    return { rawLoc, loc: decodeXmlEntities(rawLoc), lastmods, locCount: locs.length };
  });

  routeSet = new Set(
    urlEntries.map((e) => {
      try {
        return new URL(e.loc).pathname;
      } catch {
        return `__unparseable__:${e.loc}`;
      }
    }),
  );
}, 120_000);

afterAll(async () => {
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// P3 -- well-formedness of every emitted sitemap.xml entry
// ---------------------------------------------------------------------------

describe('P3: sitemap.xml well-formedness (universal over every <url> entry)', () => {
  it('parses as well-formed XML with a single root element', () => {
    expect(xmlWellFormednessErrors(sitemapXml)).toEqual([]);
  });

  it('announces a non-trivial route set (well over 400 URLs, replacing the old 95)', () => {
    // Spec: "Announce well over 400 URLs in sitemap.xml ... rather than the 95
    // it replaced." A property test still needs the emitted set to be large
    // enough that universal quantification is meaningful.
    expect(urlEntries.length).toBeGreaterThan(400);
  });

  it('every <url> carries exactly one <loc> and at least one <lastmod>', () => {
    for (const entry of urlEntries) {
      expect(entry.locCount, `<url> for ${entry.loc}`).toBe(1);
      expect(entry.lastmods.length, `<lastmod> count for ${entry.loc}`).toBe(1);
    }
  });

  it('every <lastmod> is a real calendar date in YYYY-MM-DD form', () => {
    for (const entry of urlEntries) {
      for (const lastmod of entry.lastmods) {
        expect(lastmod, `lastmod for ${entry.loc}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(
          isRealCalendarDate(lastmod),
          `lastmod ${lastmod} for ${entry.loc} is not a real calendar date`,
        ).toBe(true);
      }
    }
  });

  it('every <loc> is a syntactically valid absolute URL on the https://a14y.dev origin', () => {
    for (const entry of urlEntries) {
      expect(
        () => new URL(entry.loc),
        `<loc> ${entry.loc} is not a valid absolute URL`,
      ).not.toThrow();
      const parsed = new URL(entry.loc);
      expect(parsed.protocol, `<loc> ${entry.loc}`).toBe('https:');
      expect(parsed.origin, `<loc> ${entry.loc}`).toBe(ORIGIN);
      expect(entry.loc.startsWith(`${ORIGIN}/`) || entry.loc === ORIGIN).toBe(true);
    }
  });

  it('every <loc> is already in canonical, percent-encoded form (no re-encoding needed)', () => {
    for (const entry of urlEntries) {
      const canonical = new URL(entry.loc).href;
      expect(canonical, `<loc> ${entry.loc} is not canonically encoded`).toBe(entry.loc);
    }
  });

  it('every <loc> is XML-escaped: no raw metacharacters, no stray or doubled entities', () => {
    for (const entry of urlEntries) {
      expect(entry.rawLoc.includes('<'), `raw '<' in <loc> ${entry.rawLoc}`).toBe(false);
      expect(entry.rawLoc.includes('>'), `raw '>' in <loc> ${entry.rawLoc}`).toBe(false);
      for (let k = 0; k < entry.rawLoc.length; k++) {
        if (entry.rawLoc[k] === '&') {
          expect(
            VALID_ENTITY.test(entry.rawLoc.slice(k)),
            `unescaped '&' in <loc> ${entry.rawLoc}`,
          ).toBe(true);
        }
      }
      // Double-escaping (`&amp;amp;`) would survive one decode pass.
      expect(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/.test(entry.loc)).toBe(false);
    }
  });

  it('the <loc> set has no duplicates: one <url><loc> per route', () => {
    const locs = urlEntries.map((e) => e.loc);
    expect(new Set(locs).size, `duplicate <loc> values in sitemap.xml`).toBe(locs.length);
  });

  it('every announced route pathname has the trailing-slash shape the mirror transform assumes', () => {
    // The documented transform is `/foo/` -> `/foo.md`; a route without the
    // trailing slash has no defined mirror.
    for (const route of routeSet) {
      expect(route.startsWith('/'), `route ${route}`).toBe(true);
      expect(route.endsWith('/'), `route ${route} lacks the trailing slash`).toBe(true);
    }
  });

  it('includes /leaderboard/ and at least 300 per-site /leaderboard/<slug>/ routes', () => {
    expect(routeSet.has('/leaderboard/')).toBe(true);
    const siteRoutes = [...routeSet].filter((r) => /^\/leaderboard\/[^/]+\/$/.test(r));
    expect(siteRoutes.length).toBeGreaterThanOrEqual(300);
  });
});

// ---------------------------------------------------------------------------
// P1 + P2 -- sitemap.md mirrors exactly the sitemap.xml route set
// ---------------------------------------------------------------------------

describe('P1/P2: sitemap.md <-> sitemap.xml correspondence', () => {
  /** All internal link targets in sitemap.md that are not discovery files. */
  function sitemapMdContentLinks() {
    return markdownLinks(sitemapMd)
      .map((l) => ({ ...l, path: internalPath(l.target) }))
      .filter((l): l is ResolvedLink => l.path !== null)
      .filter((l) => !DISCOVERY_FILE_PATHS.has(l.path));
  }

  it('every link in sitemap.md is a markdown mirror derived by the documented transform', () => {
    const links = sitemapMdContentLinks();
    expect(links.length).toBeGreaterThan(400);
    for (const link of links) {
      expect(link.path.endsWith('.md'), `sitemap.md links non-mirror path ${link.path}`).toBe(true);
      const route = mirrorToRoute(link.path);
      expect(route, `sitemap.md link ${link.path} does not invert to a route`).not.toBeNull();
      // Forward direction must round-trip too.
      expect(routeToMirror(route as string)).toBe(link.path);
    }
  });

  it('no sitemap.md link points outside the sitemap.xml route set', () => {
    for (const link of sitemapMdContentLinks()) {
      const route = mirrorToRoute(link.path);
      expect(
        routeSet.has(route as string),
        `sitemap.md links ${link.path}, whose route ${route} is not announced in sitemap.xml`,
      ).toBe(true);
    }
  });

  it('the two sitemaps announce exactly the same set of routes', () => {
    const mdRoutes = new Set(
      sitemapMdContentLinks()
        .map((l) => mirrorToRoute(l.path))
        .filter((r): r is string => r !== null),
    );
    const missingFromMd = [...routeSet].filter((r) => !mdRoutes.has(r)).sort();
    const extraInMd = [...mdRoutes].filter((r) => !routeSet.has(r)).sort();
    expect(
      { missingFromMd: missingFromMd.slice(0, 20), extraInMd: extraInMd.slice(0, 20) },
    ).toEqual({ missingFromMd: [], extraInMd: [] });
    expect(mdRoutes.size).toBe(routeSet.size);
  });

  it('every route in the set is linked exactly once from sitemap.md', () => {
    const counts = new Map<string, number>();
    for (const link of sitemapMdContentLinks()) {
      counts.set(link.path, (counts.get(link.path) ?? 0) + 1);
    }
    for (const route of routeSet) {
      const mirror = routeToMirror(route);
      expect(counts.get(mirror) ?? 0, `link count for ${mirror}`).toBe(1);
    }
  });

  it('every mirror link sits under a section heading, and the named sections exist', () => {
    const lines = sitemapMd.split('\n');
    const headingLines: number[] = [];
    lines.forEach((line, idx) => {
      if (/^##\s+\S/.test(line)) headingLines.push(idx);
    });
    expect(headingLines.length).toBeGreaterThan(0);
    const firstHeading = headingLines[0];
    for (const link of sitemapMdContentLinks()) {
      expect(
        link.line > firstHeading,
        `sitemap.md link ${link.path} appears before any '##' section heading`,
      ).toBe(true);
    }
    const headings = headingLines.map((i) => lines[i].replace(/^##\s+/, '').trim());
    expect(headings).toContain('Leaderboard');
    expect(headings).toContain('Research');
  });

  it('links under ## Leaderboard and ## Research belong to those sections', () => {
    const lines = sitemapMd.split('\n');
    const headingIdx: Array<{ idx: number; title: string }> = [];
    lines.forEach((line, idx) => {
      const m = /^##\s+(.+?)\s*$/.exec(line);
      if (m) headingIdx.push({ idx, title: m[1] });
    });
    const sectionOf = (line: number): string | null => {
      let current: string | null = null;
      for (const h of headingIdx) {
        if (h.idx < line) current = h.title;
        else break;
      }
      return current;
    };
    const expectations: Array<[string, RegExp]> = [
      ['Leaderboard', /^\/leaderboard(\/|\.md$)/],
      ['Research', /^\/research(\/|\.md$)/],
    ];
    for (const [title, prefix] of expectations) {
      const inSection = markdownLinks(sitemapMd)
        .map((l) => ({ ...l, path: internalPath(l.target) }))
        .filter((l): l is ResolvedLink => l.path !== null)
        .filter((l) => !DISCOVERY_FILE_PATHS.has(l.path))
        .filter((l) => sectionOf(l.line) === title);
      expect(inSection.length, `## ${title} section is empty`).toBeGreaterThan(0);
      for (const link of inSection) {
        expect(
          prefix.test(link.path),
          `link ${link.path} is filed under '## ${title}' but is not part of that section`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// P5 + P2 -- llms.txt curates the route set, never invents
// ---------------------------------------------------------------------------

describe('P5/P2: llms.txt is a curated subset of the sitemap.xml route set', () => {
  function llmsInternalLinks() {
    return markdownLinks(llmsTxt)
      .map((l) => ({ ...l, path: internalPath(l.target) }))
      .filter((l): l is ResolvedLink => l.path !== null);
  }

  it('every internal link resolves to a route announced in sitemap.xml', () => {
    const links = llmsInternalLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      if (DISCOVERY_FILE_PATHS.has(link.path)) continue; // the full-sitemap pointer et al
      const route = link.path.endsWith('.md') ? mirrorToRoute(link.path) : link.path;
      expect(route, `llms.txt link ${link.path} does not resolve to a route`).not.toBeNull();
      expect(
        routeSet.has(route as string),
        `llms.txt links ${link.path}, whose route ${route} is not in the sitemap.xml route set`,
      ).toBe(true);
    }
  });

  it('every .md link in llms.txt is the documented mirror of a real route', () => {
    for (const link of llmsInternalLinks()) {
      if (!link.path.endsWith('.md')) continue;
      if (DISCOVERY_FILE_PATHS.has(link.path)) continue;
      const route = mirrorToRoute(link.path);
      expect(route).not.toBeNull();
      expect(routeToMirror(route as string)).toBe(link.path);
      expect(routeSet.has(route as string), `llms.txt mirror ${link.path}`).toBe(true);
    }
  });

  it('links /leaderboard.md but none of the per-site leaderboard pages', () => {
    const paths = llmsInternalLinks().map((l) => l.path);
    expect(paths).toContain('/leaderboard.md');
    const perSite = paths.filter((p) => /^\/leaderboard\/[^/]+\.md$/.test(p));
    expect(perSite, 'llms.txt must not enumerate the per-site leaderboard pages').toEqual([]);
  });

  it('stays short enough to be read start to finish', () => {
    // Spec: "the file stays under roughly 200 lines". The tolerance below
    // encodes "roughly" while still catching a file that has been inflated
    // with the 300+ per-site pages.
    const lineCount = llmsTxt.split('\n').length;
    expect(lineCount).toBeLessThanOrEqual(220);
  });

  it('lists every /research/<slug>/ route exactly once, under a real title', () => {
    const researchRoutes = [...routeSet].filter((r) => /^\/research\/[^/]+\/$/.test(r));
    expect(researchRoutes.length).toBeGreaterThan(0);

    const links = llmsInternalLinks();
    for (const route of researchRoutes) {
      const slug = /^\/research\/([^/]+)\/$/.exec(route)![1];
      const mirror = routeToMirror(route);
      const matches = links.filter((l) => l.path === mirror);
      expect(matches.length, `llms.txt entries pointing at ${mirror}`).toBe(1);

      const label = matches[0].label.trim();
      expect(label.length, `empty link title for ${mirror}`).toBeGreaterThan(0);
      // A bare or humanized slug means the article shipped without a title.
      expect(label, `${mirror} is listed under its bare slug`).not.toBe(slug);
      expect(
        label.toLowerCase(),
        `${mirror} is listed under a humanized slug rather than its real title`,
      ).not.toBe(slug.replace(/-/g, ' '));
    }
  });
});

// ---------------------------------------------------------------------------
// robots.txt -- the fixed contract
// ---------------------------------------------------------------------------

describe('robots.txt allows every crawler and points at the sitemap', () => {
  it('carries User-agent, Allow, and Sitemap directives', () => {
    const lines = robotsTxt.split('\n').map((l) => l.trim());
    expect(lines).toContain('User-agent: *');
    expect(lines).toContain('Allow: /');
    expect(lines).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('disallows nothing', () => {
    for (const line of robotsTxt.split('\n').map((l) => l.trim())) {
      if (!/^Disallow:/i.test(line)) continue;
      expect(line.replace(/^Disallow:\s*/i, ''), `robots.txt blocks a path: ${line}`).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// P6 -- no unexpanded route parameters anywhere
// ---------------------------------------------------------------------------

describe('P6: no unexpanded [param] placeholder survives into any emitted file', () => {
  const PARAM_TOKEN = /\[(\.\.\.)?(slug|version|id|page|name|category)\]/g;

  it('no emitted file contains a literal Astro route parameter token', () => {
    for (const name of EMITTED_FILES) {
      const hits = [...fileContents[name].matchAll(PARAM_TOKEN)].map((m) => m[0]);
      expect(hits, `${name} contains unexpanded route parameter(s)`).toEqual([]);
    }
    expect(agentsMd.length).toBeGreaterThan(0);
  });

  it('no path or URL emitted in any discovery file contains bracket characters', () => {
    const paths: Array<{ where: string; value: string }> = [];
    for (const entry of urlEntries) paths.push({ where: 'sitemap.xml <loc>', value: entry.loc });
    for (const l of markdownLinks(sitemapMd)) paths.push({ where: 'sitemap.md link', value: l.target });
    for (const l of markdownLinks(llmsTxt)) paths.push({ where: 'llms.txt link', value: l.target });
    for (const line of robotsTxt.split('\n')) {
      const m = /^\s*(?:Sitemap|Allow|Disallow):\s*(\S+)/i.exec(line);
      if (m) paths.push({ where: 'robots.txt directive', value: m[1] });
    }
    expect(paths.length).toBeGreaterThan(400);
    for (const p of paths) {
      expect(p.value.includes('['), `${p.where} ${p.value} contains '['`).toBe(false);
      expect(p.value.includes(']'), `${p.where} ${p.value} contains ']'`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// P4 -- idempotence
// ---------------------------------------------------------------------------

describe('P4: idempotence', () => {
  it('running the hook twice against the same publicDir produces byte-identical files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'a14y-discovery-idem-'));
    const pub = path.join(dir, 'public');
    try {
      await fs.mkdir(pub, { recursive: true });

      await runIntegration(pub);
      const first = await readTree(pub);

      await runIntegration(pub);
      const second = await readTree(pub);

      expect([...second.keys()].sort()).toEqual([...first.keys()].sort());
      for (const [name, bytes] of first) {
        const after = second.get(name);
        expect(after, `${name} disappeared on the second run`).toBeDefined();
        expect(
          Buffer.compare(bytes, after as Buffer),
          `${name} differs between the first and second run`,
        ).toBe(0);
      }
      for (const name of EMITTED_FILES) {
        expect([...first.keys()], `${name} was not written`).toContain(name);
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
