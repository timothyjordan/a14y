import type { AstroIntegration } from 'astro';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listAllScorecards,
  listPublishedScorecards,
  getChecksGroupedByCategory,
  getCheckSummary,
  getDraftDiffEntries,
  getDraftScorecardVersion,
  getLatestScorecardVersion,
  isDraftScorecardVersion,
} from '../lib/scorecard-data';
import { applyPageSubstitutions } from '../lib/page-substitutions';
import {
  renderPageMarkdown,
  extractMetadataFromHtml,
} from '../lib/html-to-markdown';

/**
 * Pages whose canonical source is the `.astro` file (too much
 * bespoke design markup to express cleanly as markdown). The
 * mirror integration reads the rendered HTML Astro just wrote to
 * `dist/<value>` and converts it via Turndown for these.
 */
const HTML_DERIVED_PAGES: Record<string, string> = {
  '': 'index.html',
  spec: 'spec/index.html',
  // The chrome-extension page has dynamic content (version, file
  // size, asset URL fetched from the GitHub Releases API at build
  // time), so authoring it as a markdown source would force us to
  // either duplicate the install steps or drop the dynamic data
  // from the mirror. Deriving the mirror from the rendered HTML
  // keeps both representations in sync from a single source.
  'chrome-extension': 'chrome-extension/index.html',
  // The press page composes content from multiple sources (the
  // pages collection for bio + one-pager, an inline comp table,
  // and live research components for the leaderboard). Deriving
  // the mirror from the rendered HTML keeps every part in sync
  // without duplicating any of them in a markdown source.
  press: 'press/index.html',
};

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

        const scorecard = listPublishedScorecards()[0]; // current = v0.2.0
        const docVersion = scorecard?.version ?? '0.2.0';

        // Index every check id pinned by ANY shipped or draft scorecard so
        // pages under `/scorecards/<v>/checks/<id>/` route to the source
        // markdown regardless of which manifest pinned the id.
        const checkIds = new Set<string>();
        for (const card of listAllScorecards()) {
          for (const id of Object.keys(card.checks)) checkIds.add(id);
        }

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

          const htmlDerivedPath = HTML_DERIVED_PAGES[cleanPath];
          if (htmlDerivedPath) {
            // Canonical source is the `.astro` file. Read the
            // rendered HTML Astro just wrote, scope to <main>, and
            // convert to clean markdown via Turndown.
            const distHtmlPath = path.join(distDir, htmlDerivedPath);
            const html = await fs.readFile(distHtmlPath, 'utf8');
            const meta = extractMetadataFromHtml(html);
            title = meta.title || humanizeSegment(cleanPath || 'a14y');
            description =
              meta.description ||
              `a14y · agent readability for the web · ${title}`;
            body = renderPageMarkdown(html);
          } else if (checkMatch && checkIds.has(checkMatch[1])) {
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
          } else if (pagesSlug === 'privacy') {
            // Privacy is split across two markdown entries with the
            // analytics opt-out button injected as JSX between them
            // (the button needs a runtime <script>; markdown can't
            // host one without dragging interactive UI into the
            // mirror). Concatenate so the mirror reads as a single
            // policy without any inline HTML.
            const introRaw = await readIfExists(
              path.join(pagesContentDir, 'privacy-intro.md'),
            );
            const tailRaw = await readIfExists(
              path.join(pagesContentDir, 'privacy-tail.md'),
            );
            if (!introRaw || !tailRaw) {
              throw new Error('Missing privacy-intro.md or privacy-tail.md');
            }
            const intro = parseFrontmatter(introRaw);
            const tail = parseFrontmatter(tailRaw);
            title = String(intro.frontmatter.title ?? 'Privacy · a14y');
            description = String(
              intro.frontmatter.description ??
                'a14y · agent readability for the web · Privacy',
            );
            const introBody = applyPageSubstitutions(intro.body).replace(/\n+$/, '');
            const tailBody = applyPageSubstitutions(tail.body).replace(/\n+$/, '');
            body = `${introBody}\n\n${tailBody}`;
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
            // without a separate markdown source. Resolves the
            // `/scorecards/draft/` alias to the current draft version.
            const versionMatch = cleanPath.match(/^scorecards\/([^/]+)$/);
            const version = versionMatch?.[1];
            if (!version) {
              throw new Error(`Could not extract version from ${cleanPath}`);
            }
            const resolvedVersion =
              version === 'draft' ? getDraftScorecardVersion() : version;
            const sc = listAllScorecards().find((c) => c.version === resolvedVersion);
            if (!sc) {
              throw new Error(`Scorecard ${version} not found`);
            }
            const draftSuffix = isDraftScorecardVersion(sc.version) ? ' (draft)' : '';
            title = `Scorecard v${sc.version}${draftSuffix} · a14y`;
            description = sc.description;
            const checksSection = renderScorecardVersionChecks(version);
            const diffSection = isDraftScorecardVersion(sc.version)
              ? `\n\n${renderScorecardDiffSection(sc.version)}`
              : '';
            body = `${sc.description}\n\n${checksSection}${diffSection}`;
          } else if (pagesSlug === 'scoring-index') {
            title = 'Scoring methodologies · a14y';
            description =
              'Every scoring algorithm ever pinned by an a14y scorecard. Each scorecard freezes its methodology so historical scores stay reproducible.';
            body = renderScoringIndex();
          } else if (pagesSlug === 'scoring-detail') {
            const idMatch = cleanPath.match(/^scorecards\/scoring\/([^/]+)$/);
            const methodologyId = idMatch?.[1];
            if (!methodologyId) {
              throw new Error(`Could not extract scoring methodology id from ${cleanPath}`);
            }
            const scoringDir = path.join(docsRoot, 'src/content/scoring');
            const raw = await readIfExists(
              path.join(scoringDir, `${methodologyId}.md`),
            );
            if (raw === null) {
              throw new Error(
                `Scoring methodology source not found for ${methodologyId} at ${scoringDir}`,
              );
            }
            const parsed = parseFrontmatter(raw);
            title = String(parsed.frontmatter.title ?? `${methodologyId} · scoring methodology`);
            description = String(
              parsed.frontmatter.description ??
                `a14y scoring methodology · ${methodologyId}`,
            );
            body = parsed.body;
          } else if (pagesSlug === 'scorecards-version-changes') {
            const versionMatch = cleanPath.match(/^scorecards\/([^/]+)\/changes$/);
            const version = versionMatch?.[1];
            if (!version) {
              throw new Error(`Could not extract version from ${cleanPath}`);
            }
            const resolvedVersion =
              version === 'draft' ? getDraftScorecardVersion() : version;
            const latestPub = getLatestScorecardVersion();
            if (isDraftScorecardVersion(resolvedVersion)) {
              title = `Draft scorecard changes vs v${latestPub} · a14y`;
              description = `Every recorded change to the in-progress scorecard ${resolvedVersion} vs the latest published v${latestPub}.`;
              body = renderDraftChangesPage(resolvedVersion);
            } else {
              title = `Scorecard v${resolvedVersion} · frozen · a14y`;
              description = `Scorecard v${resolvedVersion} is frozen; its check set and scoring methodology no longer change. The in-flight diff lives on the draft.`;
              body = renderFrozenChangesPage(resolvedVersion);
            }
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
  // `''` and `'spec'` are HTML-derived (their canonical source is
  // the `.astro` file, mirror generated via Turndown), so they
  // intentionally are NOT in the pages collection.
  if (cleanPath === 'glossary') return 'glossary';
  if (cleanPath === 'release-notes') return 'release-notes';
  if (cleanPath === 'privacy') return 'privacy';   // resolved to privacy-intro/-tail
  if (cleanPath === 'scorecards') return 'scorecards';
  if (cleanPath === 'scorecards/scoring') return 'scoring-index';
  if (/^scorecards\/scoring\/[^/]+$/.test(cleanPath)) return 'scoring-detail';
  if (/^scorecards\/[^/]+\/changes$/.test(cleanPath)) return 'scorecards-version-changes';
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
  const published = listPublishedScorecards();
  const lines: string[] = ['## Shipped versions', ''];
  if (!published.length) {
    lines.push('_No shipped scorecards yet._');
  } else {
    const latestVersion = published[0]?.version;
    for (const card of published) {
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
  }

  // The draft also appears on the page (with a banner). Include it in the
  // mirror under its own subheading so an agent reading the .md mirror sees
  // exactly the surfaces the HTML page advertises.
  const cards = listAllScorecards();
  const draft = cards.find((c) => isDraftScorecardVersion(c.version));
  if (draft) {
    lines.push('');
    lines.push('## Draft');
    lines.push('');
    const checkCount = Object.keys(draft.checks).length;
    lines.push(
      `- [v${draft.version} (draft)](/scorecards/draft/) — ${draft.description}`,
    );
    lines.push(`  unreleased · ${checkCount} checks pinned`);
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

/**
 * Render the /scorecards/scoring/ index mirror. Source-of-truth is the
 * scorecard registry — listing every methodology a manifest currently pins
 * keeps the mirror in sync as the set evolves without a separate index file.
 */
export function renderScoringIndex(): string {
  const cards = listAllScorecards();
  const byMethodology = new Map<string, string[]>();
  for (const card of cards) {
    const id = card.scoringMethodology ?? 'flat-pool-v1';
    const list = byMethodology.get(id) ?? [];
    list.push(card.version);
    byMethodology.set(id, list);
  }
  const ids = [...byMethodology.keys()].sort();
  const lines: string[] = [
    'How each a14y scorecard turns per-check pass/fail/na results into a single 0–100 number. The algorithm is pinned alongside the check set so it can evolve without retroactively changing the scores of older scorecards.',
    '',
    '## Methodologies',
    '',
  ];
  for (const id of ids) {
    const pins = byMethodology.get(id) ?? [];
    const versions = pins.map((v) => `v${v}`).join(', ');
    lines.push(
      `- [\`${id}\`](/scorecards/scoring/${id}/) — pinned by ${versions}`,
    );
  }
  return lines.join('\n');
}

/**
 * Inline diff section appended to the draft scorecard's markdown mirror so
 * agents reading the .md see the same listing the HTML page shows. Mirrors
 * `ScorecardDiff.astro` in shape and empty-state copy.
 */
export function renderScorecardDiffSection(draftVersion: string): string {
  const latest = getLatestScorecardVersion();
  const entries = getDraftDiffEntries();
  const lines: string[] = [`## Changes vs v${latest}`, ''];
  if (entries.length === 0) {
    lines.push('_No changes yet. The draft is currently identical to the latest published scorecard._');
    return lines.join('\n');
  }

  const methodology = entries.find((e) => e.kind === 'methodology-bumped');
  if (methodology && methodology.kind === 'methodology-bumped') {
    const attribution = methodology.attribution
      ? ` (by [@${methodology.attribution.author}](${methodology.attribution.authorUrl}) in [PR #${methodology.attribution.pr}](${methodology.attribution.prUrl}))`
      : ' _(attribution pending)_';
    lines.push('### Methodology');
    lines.push('');
    lines.push(
      `- Scoring methodology: [\`${methodology.fromMethodology}\`](/scorecards/scoring/${methodology.fromMethodology}/) → [\`${methodology.toMethodology}\`](/scorecards/scoring/${methodology.toMethodology}/)${attribution}`,
    );
    lines.push('');
  }

  const sections: Array<{ kind: 'added' | 'bumped' | 'removed'; heading: string }> = [
    { kind: 'added', heading: 'Added' },
    { kind: 'bumped', heading: 'Bumped' },
    { kind: 'removed', heading: 'Removed' },
  ];
  for (const section of sections) {
    const rows = entries.filter((e) => e.kind === section.kind);
    if (!rows.length) continue;
    lines.push(`### ${section.heading}`);
    lines.push('');
    for (const e of rows) {
      if (e.kind === 'methodology-bumped') continue;
      const lookupVersion = e.kind === 'removed' ? latest : draftVersion;
      const name = getCheckSummary(lookupVersion, e.id)?.name ?? e.id;
      const versionLabel =
        e.kind === 'added'
          ? `v${e.toImpl}`
          : e.kind === 'bumped'
            ? `v${e.fromImpl} → v${e.toImpl}`
            : `was v${e.fromImpl}`;
      const attribution = e.attribution
        ? ` (by [@${e.attribution.author}](${e.attribution.authorUrl}) in [PR #${e.attribution.pr}](${e.attribution.prUrl}))`
        : ' _(attribution pending)_';
      lines.push(
        `- [\`${e.id}\`](/scorecards/${lookupVersion}/checks/${e.id}.md) — ${name} · ${versionLabel}${attribution}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n').replace(/\n+$/, '');
}

/**
 * Frozen-version `/changes/` mirror. Frozen scorecards never accrue a
 * rolling diff after release, so the page is a static pointer at the
 * draft's changes page plus a link back to the version overview.
 * Exists so that switching versions in the dropdown from
 * `/scorecards/<draft>/changes/` does not 404 when landing on a frozen
 * version's `/changes/` URL.
 */
export function renderFrozenChangesPage(version: string): string {
  return [
    `Scorecard [v${version}](/scorecards/${version}/) is frozen. Its check set and scoring methodology never change after release, so there is no rolling diff to show here.`,
    '',
    'New checks, impl bumps, and methodology changes land on the [draft scorecard\'s changes page](/scorecards/draft/changes/) and are cut into a new frozen version on release. See [release notes](/release-notes/) for the published history.',
  ].join('\n');
}

/**
 * Full markdown body for the /scorecards/<draft>/changes/ release-notes
 * page. Mirrors the .astro page in shape and empty-state copy.
 */
export function renderDraftChangesPage(draftVersion: string): string {
  const latest = getLatestScorecardVersion();
  const entries = getDraftDiffEntries();
  const lines: string[] = [
    `Every recorded change to the in-progress scorecard \`${draftVersion}\` vs the latest published [v${latest}](/scorecards/${latest}/). Attribution is recorded automatically by the refresh-draft-diff workflow on every PR that touches the draft manifest.`,
    '',
  ];

  if (entries.length === 0) {
    lines.push(
      `_No contributions yet. The draft is currently identical to v${latest}. See [CONTRIBUTING.md](https://github.com/timothyjordan/a14y/blob/main/CONTRIBUTING.md#scorecard-lifecycle) to propose one._`,
    );
    return lines.join('\n');
  }

  const sortKey = (e: typeof entries[number]): string =>
    e.kind === 'methodology-bumped' ? '__methodology__' : e.id;

  const sorted = [...entries].sort((a, b) => {
    if (a.attribution && b.attribution) {
      return b.attribution.mergedAt.localeCompare(a.attribution.mergedAt);
    }
    if (a.attribution) return -1;
    if (b.attribution) return 1;
    return sortKey(a).localeCompare(sortKey(b));
  });

  lines.push('## Changes');
  lines.push('');
  for (const e of sorted) {
    const attribution = e.attribution
      ? `_${e.attribution.mergedAt.slice(0, 10)} · by [@${e.attribution.author}](${e.attribution.authorUrl}) · [PR #${e.attribution.pr}](${e.attribution.prUrl})_`
      : '_attribution pending — the refresh-draft-diff workflow hasn\'t run for this change yet_';

    if (e.kind === 'methodology-bumped') {
      lines.push(
        `- **Methodology** [\`${e.fromMethodology}\`](/scorecards/scoring/${e.fromMethodology}/) → [\`${e.toMethodology}\`](/scorecards/scoring/${e.toMethodology}/)`,
      );
      lines.push(`  ${attribution}`);
      continue;
    }

    const lookupVersion = e.kind === 'removed' ? latest : draftVersion;
    const name = getCheckSummary(lookupVersion, e.id)?.name ?? e.id;
    const versionLabel =
      e.kind === 'added'
        ? `v${e.toImpl}`
        : e.kind === 'bumped'
          ? `v${e.fromImpl} → v${e.toImpl}`
          : `was v${e.fromImpl}`;
    const kindLabel = e.kind.charAt(0).toUpperCase() + e.kind.slice(1);
    lines.push(
      `- **${kindLabel}** [\`${e.id}\`](/scorecards/${lookupVersion}/checks/${e.id}.md) — ${name} · ${versionLabel}`,
    );
    lines.push(`  ${attribution}`);
  }

  return lines.join('\n').replace(/\n+$/, '');
}
