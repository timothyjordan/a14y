import type { AstroIntegration } from 'astro';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listAllScorecards,
  getChecksGroupedByCategory,
} from '../lib/scorecard-data';
import { applyPageSubstitutions } from '../lib/page-substitutions';

/**
 * Astro integration that emits a `.md` mirror for every generated
 * HTML page on the docs site.
 *
 * Why: a14y's `markdown.mirror-suffix` check fetches
 * `<page>.md` for every audited page and expects a 2xx response with
 * markdown content. The dependent checks `markdown.frontmatter` and
 * `markdown.sitemap-section` then evaluate the body for the required
 * frontmatter fields and a `## Sitemap` section. Without this
 * integration, a14y's docs site fails its own checks.
 *
 * Strategy:
 * - For each check id (from `@a14y/core`'s scorecard registry),
 *   read the source markdown body from
 *   `src/content/checks/<id>.md`, prepend the four required
 *   frontmatter fields (`title`, `description`, `doc_version`,
 *   `last_updated`), append a `## Sitemap` footer linking to
 *   `/a14y/sitemap.md`, and emit
 *   `dist/scorecards/0.2.0/checks/<id>.md`.
 * - For non-check pages (landing, scorecards index, scorecard
 *   overview, glossary, spec), emit a small auto-generated mirror
 *   with the four required frontmatter fields and a one-line body
 *   pointing at the canonical HTML page. The point isn't a full
 *   markdown rendering of every page — it's that an agent following
 *   the .md suffix gets a real markdown response with the
 *   frontmatter the scorecard requires.
 *
 * Output paths follow Astro's `trailingSlash: 'always'` convention:
 * `/scorecards/0.2.0/checks/html.canonical-link/` becomes a mirror at
 * `/scorecards/0.2.0/checks/html.canonical-link.md`.
 */
export function markdownMirrorsIntegration(): AstroIntegration {
  return {
    name: 'a14y-markdown-mirrors',
    hooks: {
      'astro:build:done': async ({ dir, pages }) => {
        const distDir = fileURLToPath(dir);
        // Astro reports the BASE-relative pathname for each page,
        // e.g. "scorecards/0.2.0/checks/html.canonical-link/".
        const docsRoot = path.resolve(
          fileURLToPath(import.meta.url),
          '../../../',
        );
        const checksContentDir = path.join(docsRoot, 'src/content/checks');
        const pagesContentDir = path.join(docsRoot, 'src/content/pages');

        const lastUpdated = new Date().toISOString();
        const sitemapHref = '/sitemap.md';

        const scorecard = listAllScorecards()[0]; // current = v0.2.0
        const docVersion = scorecard?.version ?? '0.2.0';

        // Index every check id once so we can fast-route by URL.
        const checkIds = new Set<string>(
          scorecard ? Object.keys(scorecard.checks) : [],
        );

        for (const page of pages) {
          // page.pathname is "" for /, "scorecards/" for /scorecards/, etc.
          const cleanPath = page.pathname.replace(/\/$/, '');

          // Mirror file lives at the same hierarchy with .md suffix.
          // For the landing page (cleanPath === ''), use "index.md".
          const mirrorRel = cleanPath === '' ? 'index.md' : `${cleanPath}.md`;
          const mirrorAbs = path.join(distDir, mirrorRel);
          await fs.mkdir(path.dirname(mirrorAbs), { recursive: true });

          // Determine if this is a check-detail page so we can copy
          // the canonical source markdown body.
          const checkMatch = cleanPath.match(
            /^scorecards\/[^/]+\/checks\/(.+)$/,
          );
          // Resolve the matching `pages` collection slug for non-check
          // pages. A non-null result means we have an authored
          // markdown source whose body becomes the mirror body.
          const pagesSlug = resolvePagesSlug(cleanPath);
          let body: string;
          let title: string;
          let description: string;

          if (checkMatch && checkIds.has(checkMatch[1])) {
            const checkId = checkMatch[1];
            const sourcePath = path.join(checksContentDir, `${checkId}.md`);
            const raw = await fs.readFile(sourcePath, 'utf8');
            // The source already has frontmatter. Extract title +
            // description from it; the body we forward to the mirror
            // is the source minus its frontmatter (we re-emit our own
            // frontmatter with the four required fields below).
            const parsed = parseFrontmatter(raw);
            title = String(parsed.frontmatter.title ?? checkId);
            description = String(
              parsed.frontmatter.why ?? parsed.frontmatter.description ?? title,
            );
            body = parsed.body;
          } else if (pagesSlug === 'scorecards') {
            // The /scorecards/ page is split across two markdown
            // entries with a build-time-rendered version list
            // between them. Concatenate so the mirror has the same
            // visual order the .astro page renders.
            const introRaw = await readIfExists(
              path.join(pagesContentDir, 'scorecards-intro.md'),
            );
            const tailRaw = await readIfExists(
              path.join(pagesContentDir, 'scorecards-tail.md'),
            );
            if (!introRaw || !tailRaw) {
              throw new Error('Missing scorecards-intro.md or scorecards-tail.md');
            }
            const intro = parseFrontmatter(introRaw);
            const tail = parseFrontmatter(tailRaw);
            title = String(intro.frontmatter.title ?? 'Scorecards · a14y');
            description = String(
              intro.frontmatter.description ??
                'a14y · agent readability for the web · Scorecards',
            );
            const introBody = applyPageSubstitutions(intro.body).replace(/\n+$/, '');
            const tailBody = applyPageSubstitutions(tail.body).replace(/\n+$/, '');
            body = `${introBody}\n\n${renderShippedVersionsList()}\n\n${tailBody}`;
          } else if (pagesSlug === 'scorecards-version') {
            // The /scorecards/<version>/ page is fully dynamic — its
            // entire content (h1, description, check listings) comes
            // from the scorecard registry. The mirror is synthesized
            // from the same registry so HTML and .md stay in sync
            // without a separate markdown source.
            const versionMatch = cleanPath.match(/^scorecards\/([^/]+)$/);
            const version = versionMatch?.[1];
            if (!version) {
              throw new Error(`Could not extract version from ${cleanPath}`);
            }
            const sc = listAllScorecards().find((c) => c.version === version);
            if (!sc) {
              throw new Error(`Scorecard ${version} not found`);
            }
            title = `Scorecard v${sc.version} · a14y`;
            description = sc.description;
            body = `${sc.description}\n\n${renderScorecardVersionChecks(version)}`;
          } else if (pagesSlug && (await readIfExists(path.join(pagesContentDir, `${pagesSlug}.md`))) !== null) {
            const sourcePath = path.join(pagesContentDir, `${pagesSlug}.md`);
            const raw = (await readIfExists(sourcePath))!;
            const parsed = parseFrontmatter(raw);
            title = String(parsed.frontmatter.title ?? humanizeSegment(cleanPath || 'a14y'));
            description = String(
              parsed.frontmatter.description ??
                `a14y · agent readability for the web · ${title}`,
            );
            body = applyPageSubstitutions(parsed.body);
          } else {
            // Fallback for any page added without a matching `pages`
            // collection entry: emit the legacy stub so the mirror
            // route still returns valid markdown.
            title = humanizeSegment(cleanPath || 'a14y');
            description = `a14y · agent readability for the web · ${title}`;
            const canonicalPath = cleanPath === '' ? '/' : `/${cleanPath}/`;
            body = `# ${title}\n\nThis is the markdown mirror of [${canonicalPath}](${canonicalPath}). Open the canonical page for the full rendered version with navigation, code blocks, and the version selector.\n`;
          }

          const frontmatter = formatFrontmatter({
            title,
            description,
            doc_version: docVersion,
            last_updated: lastUpdated,
          });

          const sitemapFooter = `\n## Sitemap\n\nFull docs site index: [${sitemapHref}](${sitemapHref}).\n`;

          await fs.writeFile(
            mirrorAbs,
            `${frontmatter}\n${body.replace(/\n+$/, '')}\n${sitemapFooter}`,
            'utf8',
          );
        }
      },
    },
  };
}

interface ParsedFrontmatter {
  frontmatter: Record<string, unknown>;
  body: string;
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  // Minimal YAML frontmatter parser — only handles the shapes we
  // emit in src/content/checks/*.md (key: value, key: > with a
  // following indented block, and key: list of objects). We use
  // gray-matter via @a14y/core for the runtime check, but
  // pulling it into an Astro build integration creates a CJS/ESM
  // interop headache, so this hand-roll is the simpler path.
  if (!raw.startsWith('---')) return { frontmatter: {}, body: raw };
  const end = raw.indexOf('\n---', 4);
  if (end === -1) return { frontmatter: {}, body: raw };
  const fmText = raw.slice(4, end);
  const body = raw.slice(end + 4).replace(/^\n/, '');
  const fm: Record<string, unknown> = {};
  // Capture top-level "key:" lines and everything that belongs to
  // their value. We only need a few fields (title, why, description),
  // so accept literal scalars on the same line and the leading line
  // of a folded scalar (`>`).
  const lines = fmText.split('\n');
  let currentKey: string | null = null;
  let currentValue: string[] = [];
  const flush = () => {
    if (currentKey === null) return;
    fm[currentKey] = currentValue.join(' ').trim();
    currentKey = null;
    currentValue = [];
  };
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/);
    if (m && !line.startsWith(' ') && !line.startsWith('\t')) {
      flush();
      const [, key, value] = m;
      currentKey = key;
      if (value && value !== '>' && value !== '|') {
        currentValue.push(stripQuotes(value));
      }
    } else if (currentKey !== null) {
      // Continuation line of a folded scalar.
      const trimmed = line.replace(/^\s+/, '');
      if (trimmed && !trimmed.startsWith('-')) currentValue.push(trimmed);
    }
  }
  flush();
  return { frontmatter: fm, body };
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function formatFrontmatter(fm: Record<string, string>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    lines.push(`${k}: ${escapeYamlScalar(v)}`);
  }
  lines.push('---');
  return lines.join('\n');
}

function escapeYamlScalar(value: string): string {
  // Quote anything containing a colon, hash, or starting whitespace
  // — keeps the YAML parser well-behaved.
  if (/[:#'"\n]/.test(value) || /^\s/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      return null;
    }
    throw err;
  }
}

function humanizeSegment(segmentPath: string): string {
  if (!segmentPath) return 'a14y docs';
  const last = segmentPath.split('/').filter(Boolean).pop() ?? segmentPath;
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Map a build-output URL (without trailing slash) to the slug of a
 * `pages` content collection entry. Returning null means the URL is
 * not page-collection-backed and the caller should use the legacy
 * fallback stub.
 */
export function resolvePagesSlug(cleanPath: string): string | null {
  if (cleanPath === '') return 'index';
  if (cleanPath === 'spec') return 'spec';
  if (cleanPath === 'glossary') return 'glossary';
  if (cleanPath === 'privacy') return 'privacy';
  if (cleanPath === 'scorecards') return 'scorecards';
  if (/^scorecards\/[^/]+$/.test(cleanPath)) return 'scorecards-version';
  return null;
}

/**
 * Render the "Shipped versions" listing for the /scorecards/ index
 * mirror. Source-of-truth is the in-repo scorecard registry, so a
 * new published scorecard automatically appears in the mirror as it
 * does on the .astro page.
 */
export function renderShippedVersionsList(): string {
  const cards = listAllScorecards();
  if (!cards.length) return '## Shipped versions\n';
  const latestVersion = cards[0]?.version;
  const lines: string[] = ['## Shipped versions', ''];
  for (const card of cards) {
    const isLatest = card.version === latestVersion;
    const label = `v${card.version}${isLatest ? ' (latest)' : ''}`;
    const checkCount = Object.keys(card.checks).length;
    lines.push(
      `- [${label}](/scorecards/${card.version}/) — ${card.description}`,
    );
    lines.push(
      `  released ${card.releasedAt} · ${checkCount} checks pinned`,
    );
  }
  return lines.join('\n');
}

/**
 * Render the dynamic site-checks + page-checks listing for a single
 * scorecard version as markdown. Source-of-truth is the in-repo
 * scorecard registry, so the mirror stays in sync with the .astro
 * shell that renders the same data as `<CheckCard>` items.
 */
export function renderScorecardVersionChecks(version: string): string {
  const groups = getChecksGroupedByCategory(version);
  const siteGroups = groups.filter((g) => g.scope === 'site');
  const pageGroups = groups.filter((g) => g.scope === 'page');
  const lines: string[] = [];
  if (siteGroups.length) {
    lines.push('## Site checks');
    lines.push('');
    for (const g of siteGroups) {
      lines.push(`### ${g.group}`);
      lines.push('');
      for (const c of g.checks) {
        lines.push(`- [\`${c.id}\`](/scorecards/${version}/checks/${c.id}.md) — ${c.name}`);
      }
      lines.push('');
    }
  }
  if (pageGroups.length) {
    lines.push('## Page checks');
    lines.push('');
    for (const g of pageGroups) {
      lines.push(`### ${g.group}`);
      lines.push('');
      for (const c of g.checks) {
        lines.push(`- [\`${c.id}\`](/scorecards/${version}/checks/${c.id}.md) — ${c.name}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n').replace(/\n+$/, '');
}
