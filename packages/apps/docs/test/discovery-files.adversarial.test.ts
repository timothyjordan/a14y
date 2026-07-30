import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

// Subject under test (alias configured by the runner).
import { discoveryFilesIntegration } from '../src/integrations/discovery-files';

// Cross-check oracle. The spec defines the emitted URL set as "exactly the
// paths listSiteRoutes() returns", so the route list is the oracle for the
// sitemap contents, not the integration's own output.
import { listSiteRoutes } from '../src/lib/site-routes';

/**
 * Adversarial tests for the discovery-files integration, written from
 * `src/integrations/discovery-files.spec.md` only.
 *
 * The regression these guard is concrete: the discovery files used to be
 * generated from a hardcoded array that announced 95 URLs while the site
 * served ~425, silently dropping /leaderboard/, its 300+ per-site pages,
 * and four of the five /research/ articles. Every assertion below is
 * derived from the spec's "Should" claims or from the filesystem
 * (`src/pages/research/*.astro`), never from a hardcoded expected list.
 */

const ORIGIN = 'https://a14y.dev';

/** Route path -> canonical absolute URL announced in sitemap.xml. */
function locFor(route: string): string {
  return `${ORIGIN}${route}`;
}

/** Route path -> its markdown mirror, per the spec: `/foo/` -> `/foo.md`, `/` -> `/index.md`. */
function mirrorFor(route: string): string {
  if (route === '/') return '/index.md';
  return `${route.replace(/\/$/, '')}.md`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

/**
 * Collapses free text down to a slug shape. If a research article's link
 * text collapses to its own slug, the article was listed under a bare or
 * humanized slug, which the spec says must never happen (it means the
 * article shipped without a title).
 */
function collapseToSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Every markdown link in a document, as [text, href] pairs. */
function markdownLinks(source: string): Array<{ text: string; href: string }> {
  return [...source.matchAll(/\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => ({
    text: m[1].trim(),
    href: m[2].trim(),
  }));
}

/** Strips an optional origin prefix so `https://a14y.dev/x.md` and `/x.md` compare equal. */
function toPath(href: string): string {
  return href.startsWith(ORIGIN) ? href.slice(ORIGIN.length) || '/' : href;
}

describe('discoveryFilesIntegration', () => {
  let tmp: string;
  let publicDir: string;

  let routes: string[];
  let researchSlugs: string[];

  let sitemapXml: string;
  let sitemapMd: string;
  let llmsTxt: string;
  let robotsTxt: string;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'a14y-discovery-adv-'));
    publicDir = path.join(tmp, 'public');
    await fs.mkdir(publicDir, { recursive: true });

    const integration = discoveryFilesIntegration();
    const setupHook = integration.hooks['astro:config:setup']!;
    await (setupHook as (args: unknown) => Promise<void>)({
      config: { publicDir: pathToFileURL(publicDir + '/') },
    });

    const read = (name: string) => fs.readFile(path.join(publicDir, name), 'utf8');
    [sitemapXml, sitemapMd, llmsTxt, robotsTxt] = await Promise.all([
      read('sitemap.xml'),
      read('sitemap.md'),
      read('llms.txt'),
      read('robots.txt'),
    ]);

    routes = listSiteRoutes();

    // Research articles are derived from the filesystem, not a hardcoded
    // list, so a newly added article is covered the moment it lands.
    const researchDir = fileURLToPath(new URL('../src/pages/research/', import.meta.url));
    const entries = await fs.readdir(researchDir, { withFileTypes: true });
    researchSlugs = entries
      .filter((e) => e.isFile() && e.name.endsWith('.astro') && e.name !== 'index.astro')
      .map((e) => e.name.replace(/\.astro$/, ''))
      .sort();
  });

  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------- fixtures

  it('the research-article fixture is non-trivial (guards the derivation itself)', () => {
    // If this collapses to zero, every research assertion below would pass
    // vacuously. The spec references "five research articles".
    expect(researchSlugs.length).toBeGreaterThanOrEqual(5);
  });

  // -------------------------------------------------------------- sitemap.xml

  it('sitemap.xml parses as well-formed XML', () => {
    const result = XMLValidator.validate(sitemapXml);
    expect(result).toBe(true);
  });

  it('sitemap.xml is a sitemaps.org urlset', () => {
    expect(sitemapXml).toContain('http://www.sitemaps.org/schemas/sitemap/0.9');
    expect(sitemapXml).toMatch(/<urlset[\s>]/);
    expect(sitemapXml).toContain('</urlset>');
  });

  it('sitemap.xml <loc> set equals listSiteRoutes() origin-prefixed with https://a14y.dev', () => {
    const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });
    const parsed = parser.parse(sitemapXml) as {
      urlset?: { url?: unknown };
    };
    const urlNodes = parsed.urlset?.url;
    const urls = (Array.isArray(urlNodes) ? urlNodes : [urlNodes]) as Array<{
      loc?: string;
      lastmod?: string;
    }>;

    const emitted = urls.map((u) => u.loc);
    const expected = routes.map(locFor);

    // Set equality in both directions: nothing missing, nothing invented.
    const emittedSet = new Set(emitted);
    const expectedSet = new Set(expected);
    const missing = expected.filter((u) => !emittedSet.has(u));
    const extra = emitted.filter((u) => u === undefined || !expectedSet.has(u));

    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
    // One <url><loc> per path, so no duplicate <loc> entries either.
    expect(emitted.length).toBe(routes.length);
    expect(emittedSet.size).toBe(emitted.length);
  });

  it('every sitemap.xml <url> carries a valid <lastmod>', () => {
    const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });
    const parsed = parser.parse(sitemapXml) as { urlset?: { url?: unknown } };
    const urlNodes = parsed.urlset?.url;
    const urls = (Array.isArray(urlNodes) ? urlNodes : [urlNodes]) as Array<{
      loc?: string;
      lastmod?: string;
    }>;

    const withoutLastmod = urls.filter((u) => !u.lastmod).map((u) => u.loc);
    expect(withoutLastmod).toEqual([]);

    // W3C datetime, as the sitemap protocol requires, and a real date.
    const bad = urls.filter((u) => {
      const v = String(u.lastmod);
      if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/.test(v)) {
        return true;
      }
      return Number.isNaN(Date.parse(v));
    });
    expect(bad.map((u) => `${u.loc} -> ${u.lastmod}`)).toEqual([]);

    // A <lastmod> per <url>, not one shared node that the parser folded.
    const lastmodCount = (sitemapXml.match(/<lastmod>/g) ?? []).length;
    const urlCount = (sitemapXml.match(/<url>/g) ?? []).length;
    expect(lastmodCount).toBe(urlCount);
    expect(urlCount).toBe(routes.length);
  });

  it('sitemap.xml announces well over 400 URLs, not the 95 it replaced', () => {
    const locCount = (sitemapXml.match(/<loc>/g) ?? []).length;
    expect(locCount).toBeGreaterThan(400);
  });

  it('sitemap.xml includes /leaderboard/ and at least 300 per-site leaderboard URLs', () => {
    const rawLocs = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => unescapeXml(m[1]));

    expect(rawLocs).toContain(`${ORIGIN}/leaderboard/`);

    const perSite = rawLocs.filter((u) =>
      /^https:\/\/a14y\.dev\/leaderboard\/[^/]+\/$/.test(u),
    );
    expect(perSite.length).toBeGreaterThanOrEqual(300);
  });

  it('sitemap.xml includes every /research/<slug>/ article page', () => {
    const rawLocs = new Set(
      [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => unescapeXml(m[1])),
    );
    const missing = researchSlugs.filter((slug) => !rawLocs.has(`${ORIGIN}/research/${slug}/`));
    expect(missing).toEqual([]);
    expect(rawLocs.has(`${ORIGIN}/research/`)).toBe(true);
  });

  it('sitemap.xml escapes XML metacharacters in every emitted URL', () => {
    const rawLocs = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(rawLocs.length).toBe(routes.length);

    for (const raw of rawLocs) {
      // No raw angle brackets inside character data.
      expect(raw).not.toMatch(/[<>]/);
      // Every ampersand must open a legal entity reference.
      const stripped = raw.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, '');
      expect(stripped).not.toContain('&');
    }

    // Document-wide: an unescaped `&` anywhere breaks the whole sitemap for
    // every consumer, not just the offending <loc>.
    expect(sitemapXml).not.toMatch(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/);

    // And each emitted <loc> is exactly the correctly-escaped form of its route.
    const expectedRaw = new Set(routes.map((r) => escapeXml(locFor(r))));
    const wrong = rawLocs.filter((raw) => !expectedRaw.has(raw));
    expect(wrong).toEqual([]);
  });

  // --------------------------------------------------------------- sitemap.md

  it('sitemap.md links the markdown mirror of every route', () => {
    const linked = new Set(markdownLinks(sitemapMd).map((l) => toPath(l.href)));
    const missing = routes.map(mirrorFor).filter((m) => !linked.has(m));
    expect(missing).toEqual([]);
  });

  it('sitemap.md maps `/` to /index.md and a section route to <section>.md', () => {
    const linked = new Set(markdownLinks(sitemapMd).map((l) => toPath(l.href)));
    expect(linked.has('/index.md')).toBe(true);
    expect(linked.has('/leaderboard.md')).toBe(true);
    expect(linked.has('/research.md')).toBe(true);
    // The trailing-slash form is a route, never a markdown mirror.
    expect(linked.has('/leaderboard/.md')).toBe(false);
    expect(linked.has('/.md')).toBe(false);
  });

  it('sitemap.md references no .md path that does not correspond to a route', () => {
    const expected = new Set(routes.map(mirrorFor));

    // Every markdown path mentioned anywhere in the file, linked or bare.
    // The trailing lookahead matters: `\b` would stop inside a longer path
    // whenever a slug contains `.md-`, so `llms-txt.md-extensions.md` would
    // yield a phantom `llms-txt.md` orphan. Requiring the next character to
    // be outside the path alphabet matches whole paths only.
    const mentioned = [...sitemapMd.matchAll(/\/[A-Za-z0-9._\-/]*\.md(?![A-Za-z0-9._\-/])/g)].map(
      (m) => m[0],
    );

    // The two site-level discovery artifacts are real files written by this
    // same integration, not page mirrors, so they are not route-backed.
    const isDiscoveryArtifact = (p: string) =>
      p === '/AGENTS.md' || p === '/sitemap.md' || p.startsWith('/.well-known/');

    const orphans = [
      ...new Set(mentioned.filter((p) => !expected.has(p) && !isDiscoveryArtifact(p))),
    ].sort();
    expect(orphans).toEqual([]);
  });

  it('sitemap.md groups routes under section headings including Leaderboard and Research', () => {
    const headings = [...sitemapMd.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
    expect(headings).toContain('Leaderboard');
    expect(headings).toContain('Research');
    // "a heading per top-level section" - more than the two named above.
    expect(headings.length).toBeGreaterThan(2);
  });

  it('sitemap.md lists the per-site leaderboard mirrors it must not omit', () => {
    const linked = new Set(markdownLinks(sitemapMd).map((l) => toPath(l.href)));
    const perSiteRoutes = routes.filter((r) => /^\/leaderboard\/[^/]+\/$/.test(r));
    expect(perSiteRoutes.length).toBeGreaterThanOrEqual(300);
    const missing = perSiteRoutes.map(mirrorFor).filter((m) => !linked.has(m));
    expect(missing).toEqual([]);
  });

  // ----------------------------------------------------------------- llms.txt

  it('llms.txt lists every research article with a real title, never a bare or humanized slug', () => {
    const links = markdownLinks(llmsTxt);

    for (const slug of researchSlugs) {
      const target = `/research/${slug}.md`;
      const matches = links.filter((l) => toPath(l.href) === target);

      expect(
        matches.length,
        `llms.txt has no entry pointing at ${target}`,
      ).toBeGreaterThanOrEqual(1);

      for (const match of matches) {
        expect(match.text, `empty link text for ${target}`).not.toBe('');
        // A title that collapses back to its own slug is the bare/humanized
        // slug the spec forbids: it means the article shipped without a title.
        expect(
          collapseToSlug(match.text),
          `${target} is listed under a bare or humanized slug: "${match.text}"`,
        ).not.toBe(slug);
      }
    }
  });

  it('llms.txt lists each research article exactly once', () => {
    const links = markdownLinks(llmsTxt);
    const counts = researchSlugs.map((slug) => ({
      slug,
      n: links.filter((l) => toPath(l.href) === `/research/${slug}.md`).length,
    }));
    expect(counts.filter((c) => c.n !== 1)).toEqual([]);
  });

  it('llms.txt references no /research/<slug>.md that is not a route', () => {
    const routeSlugs = new Set(
      routes
        .map((r) => /^\/research\/([^/]+)\/$/.exec(r)?.[1])
        .filter((s): s is string => Boolean(s)),
    );
    // The filesystem-derived articles must all be real routes too.
    expect(researchSlugs.filter((s) => !routeSlugs.has(s))).toEqual([]);

    const referenced = [...llmsTxt.matchAll(/\/research\/([A-Za-z0-9._-]+)\.md\b/g)].map(
      (m) => m[1],
    );
    const orphans = [...new Set(referenced.filter((s) => !routeSlugs.has(s)))].sort();
    expect(orphans).toEqual([]);
  });

  it('llms.txt links /leaderboard.md but none of the per-site leaderboard pages', () => {
    const paths = markdownLinks(llmsTxt).map((l) => toPath(l.href));
    expect(paths).toContain('/leaderboard.md');

    // Anywhere in the file, linked or bare: no /leaderboard/<slug>.md entries.
    const perSite = [...new Set(llmsTxt.match(/\/leaderboard\/[A-Za-z0-9._-]+\.md\b/g) ?? [])];
    expect(perSite).toEqual([]);
  });

  it('llms.txt stays under roughly 200 lines', () => {
    const lines = llmsTxt.replace(/\n+$/, '').split('\n');
    expect(lines.length).toBeLessThanOrEqual(200);
  });

  it('llms.txt still points at the full sitemap it defers the long tail to', () => {
    expect(llmsTxt).toMatch(/sitemap\.(md|xml)/);
  });

  // ---------------------------------------------------------------- robots.txt

  it('robots.txt allows every crawler and points at the sitemap', () => {
    const lines = robotsTxt.split('\n').map((l) => l.trim());
    expect(lines).toContain('User-agent: *');
    expect(lines).toContain('Allow: /');
    expect(lines).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  it('robots.txt does not blanket-disallow any crawler', () => {
    const lines = robotsTxt.split('\n').map((l) => l.trim());
    const blanket = lines.filter((l) => /^Disallow:\s*\/\s*$/i.test(l));
    expect(blanket).toEqual([]);
  });
});
