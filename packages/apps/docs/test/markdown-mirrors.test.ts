import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import {
  HTML_DERIVED_PAGES,
  readRenderedMetadata,
  resolvePagesSlug,
  renderShippedVersionsList,
  renderScorecardVersionChecks,
  renderScorecardDiffSection,
  renderDraftChangesPage,
  renderFrozenChangesPage,
} from '../src/integrations/markdown-mirrors';
import {
  getDraftScorecardVersion,
  getLatestScorecardVersion,
} from '../src/lib/scorecard-data';

describe('markdown-mirrors helpers', () => {
  describe('HTML_DERIVED_PAGES', () => {
    // These data-driven / interactive .astro pages have no markdown
    // source. They must be registered here so their mirrors are
    // generated from the rendered HTML (full content) instead of
    // falling through to the legacy stub fallback. Regression guard
    // for the research case study, research index, leaderboard, and
    // badge mirrors that used to be served as stubs.
    it.each([
      ['research', 'research/index.html'],
      ['research/scorecard-evals', 'research/scorecard-evals/index.html'],
      ['leaderboard', 'leaderboard/index.html'],
      ['badge', 'badge/index.html'],
      ['badge/how-to-embed', 'badge/how-to-embed/index.html'],
    ])('routes %s to its rendered HTML', (cleanPath, htmlFile) => {
      expect(HTML_DERIVED_PAGES[cleanPath]).toBe(htmlFile);
    });

    it('does not also claim these paths as pages-collection entries', () => {
      // A page is either HTML-derived or pages-collection-backed, not
      // both. resolvePagesSlug must stay null for the HTML-derived set
      // so the integration takes the Turndown branch.
      for (const cleanPath of Object.keys(HTML_DERIVED_PAGES)) {
        expect(resolvePagesSlug(cleanPath)).toBeNull();
      }
    });
  });

  describe('resolvePagesSlug', () => {
    it('returns null for HTML-derived pages (index, spec)', () => {
      // The landing page and /spec/ are authored as .astro and have
      // their mirrors generated via Turndown from the rendered HTML
      // — not from a `pages` collection entry.
      expect(resolvePagesSlug('')).toBeNull();
      expect(resolvePagesSlug('spec')).toBeNull();
    });

    it('maps prose-heavy pages to their content collection slugs', () => {
      expect(resolvePagesSlug('glossary')).toBe('glossary');
      expect(resolvePagesSlug('release-notes')).toBe('release-notes');
      expect(resolvePagesSlug('privacy')).toBe('privacy');
      expect(resolvePagesSlug('scorecards')).toBe('scorecards');
    });

    it('maps any /scorecards/<version>/ to "scorecards-version"', () => {
      expect(resolvePagesSlug('scorecards/0.2.0')).toBe('scorecards-version');
      expect(resolvePagesSlug('scorecards/1.0.0')).toBe('scorecards-version');
    });

    it('maps /scorecards/<version>/changes/ to "scorecards-version-changes"', () => {
      expect(resolvePagesSlug('scorecards/draft/changes')).toBe('scorecards-version-changes');
      expect(resolvePagesSlug('scorecards/0.3.0-draft/changes')).toBe('scorecards-version-changes');
    });

    it('returns null for check-detail and unknown paths', () => {
      expect(resolvePagesSlug('scorecards/0.2.0/checks/foo')).toBeNull();
      expect(resolvePagesSlug('made-up-path')).toBeNull();
    });
  });

  describe('renderShippedVersionsList', () => {
    it('emits a "## Shipped versions" heading and a bullet per scorecard', () => {
      const out = renderShippedVersionsList();
      expect(out).toMatch(/^## Shipped versions/m);
      const latest = getLatestScorecardVersion();
      expect(out).toContain(`v${latest} (latest)`);
      expect(out).toContain(`/scorecards/${latest}/`);
      expect(out).toContain('checks pinned');
    });
  });

  describe('renderScorecardVersionChecks', () => {
    it('emits both Site checks and Page checks sections with grouped bullet links', () => {
      const latest = getLatestScorecardVersion();
      const out = renderScorecardVersionChecks(latest);
      expect(out).toMatch(/^## Site checks/m);
      expect(out).toMatch(/^## Page checks/m);
      // Site groups produce ### subheadings.
      expect(out).toMatch(/^### /m);
      // Each check links to its mirror at the .md suffix.
      expect(out).toMatch(/\[`[^`]+`\]\(\/scorecards\/[^/]+\/checks\/[^)]+\.md\)/);
    });

    it('resolves the "draft" alias to the current draft scorecard', () => {
      // Should not throw — the alias is resolved by getScorecardByVersion.
      const out = renderScorecardVersionChecks('draft');
      expect(out).toMatch(/^## Site checks/m);
    });
  });

  describe('renderShippedVersionsList draft section', () => {
    it('emits a "## Draft" section with a link to /scorecards/draft/', () => {
      const out = renderShippedVersionsList();
      // Driven by whether a draft is currently registered. The draft
      // exists today (0.3.0-draft); if a future cut leaves no draft,
      // this assertion needs revisiting alongside that change.
      expect(out).toMatch(/^## Draft/m);
      expect(out).toContain('(draft)');
      expect(out).toContain('/scorecards/draft/');
    });
  });

  describe('renderScorecardDiffSection', () => {
    it('emits a "## Changes vs v<latest>" heading even when the diff is empty', () => {
      const out = renderScorecardDiffSection(getDraftScorecardVersion());
      const latest = getLatestScorecardVersion();
      expect(out).toMatch(new RegExp(`^## Changes vs v${latest.replace('.', '\\.')}`, 'm'));
    });

    it('renders an Added subheading with each new check id when the draft has diverged', () => {
      // The draft has diverged from the latest published scorecard: TJ-456
      // landed three new markdown.* checks (spec PR). If a future PR removes
      // or bumps them, update this assertion to match.
      const out = renderScorecardDiffSection(getDraftScorecardVersion());
      expect(out).not.toContain('No changes yet');
      expect(out).toMatch(/^### Added/m);
      expect(out).toContain('markdown.navigation-stripped');
      expect(out).toContain('markdown.size-reduction');
      expect(out).toContain('markdown.valid-markdown');
    });

    it('renders a Methodology subheading linking both scoring pages', () => {
      // The draft pins per-check-mean-v1 vs v0.2.0's flat-pool-v1 (PR #53).
      // The change must surface as its own subsection so an agent reading the
      // .md mirror sees the same algorithm-change context the HTML page shows.
      const out = renderScorecardDiffSection(getDraftScorecardVersion());
      expect(out).toMatch(/^### Methodology/m);
      expect(out).toContain('/scorecards/scoring/flat-pool-v1/');
      expect(out).toContain('/scorecards/scoring/per-check-mean-v1/');
    });
  });

  describe('renderDraftChangesPage', () => {
    it('mentions the latest published version and links back to its scorecard page', () => {
      const out = renderDraftChangesPage(getDraftScorecardVersion());
      const latest = getLatestScorecardVersion();
      expect(out).toContain(`v${latest}`);
      expect(out).toContain(`/scorecards/${latest}/`);
    });

    it('lists the diverged check ids under a Changes heading', () => {
      const out = renderDraftChangesPage(getDraftScorecardVersion());
      expect(out).not.toContain('No contributions yet');
      expect(out).toMatch(/^## Changes/m);
      expect(out).toContain('markdown.navigation-stripped');
      expect(out).toContain('markdown.size-reduction');
      expect(out).toContain('markdown.valid-markdown');
    });

    it('emits a Methodology bullet linking both scoring pages', () => {
      const out = renderDraftChangesPage(getDraftScorecardVersion());
      expect(out).toContain('**Methodology**');
      expect(out).toContain('/scorecards/scoring/flat-pool-v1/');
      expect(out).toContain('/scorecards/scoring/per-check-mean-v1/');
    });
  });

  describe('renderFrozenChangesPage', () => {
    // Regression for the dropdown-404 bug (TJ-598): /<frozen>/changes/ used
    // to 404 because the page only existed for the draft. The mirror needs
    // to emit a static pointer body so direct-link + dropdown switches both
    // resolve to real markdown.
    it('frames a first-release version as "no predecessor to diff against"', () => {
      // v0.2.0 is currently the first (and only) published release. The
      // copy must reflect that, not a generic "scorecard is frozen" body.
      const out = renderFrozenChangesPage(getLatestScorecardVersion());
      expect(out).toContain(`v${getLatestScorecardVersion()}`);
      expect(out).toContain('first scorecard release');
      expect(out).toContain('/scorecards/draft/changes/');
      expect(out).not.toContain('**Added**');
      expect(out).not.toContain('**Bumped**');
      // No "successor to" framing when this version IS the first.
      expect(out).not.toContain('successor to');
    });
  });

});

/**
 * The fallback mirror branch (any page with no `pages` collection entry
 * and no HTML_DERIVED_PAGES registration) used to derive frontmatter
 * from the URL slug. All 326 /leaderboard/<slug>/ pages land there, so
 * every one of them got `title: Stripe` and a boilerplate description,
 * discarding the metadata the page had already worked out. TJ-1348
 * makes the fallback read the rendered page instead.
 */
describe('readRenderedMetadata', () => {
  let distDir: string;

  beforeAll(async () => {
    distDir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'a14y-mirror-test-'));
    const write = async (cleanPath: string, html: string) => {
      const dir = nodePath.join(distDir, cleanPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(nodePath.join(dir, 'index.html'), html, 'utf8');
    };
    await write(
      'leaderboard/merriam-webster',
      '<html><head><title>Merriam-Webster: llms.txt, robots.txt and sitemap.xml · a14y</title>' +
        '<meta name="description" content="Merriam-Webster scores 52/100 for agent readability."></head></html>',
    );
    // A site name carrying an ampersand: the HTML is correctly escaped,
    // and each field is escaped by a different rule.
    await write(
      'leaderboard/mckinsey',
      '<html><head><title>McKinsey &amp; Company: llms.txt · a14y</title>' +
        '<meta name="description" content="McKinsey &#38; Company scores 29/100."></head></html>',
    );
    await write('leaderboard/bare', '<html><body>no head metadata</body></html>');
  });

  afterAll(async () => {
    await fs.rm(distDir, { recursive: true, force: true });
  });

  it('reads the rendered title and description for a built page', async () => {
    const meta = await readRenderedMetadata(distDir, 'leaderboard/merriam-webster');
    expect(meta).not.toBeNull();
    expect(meta!.title).toBe('Merriam-Webster: llms.txt, robots.txt and sitemap.xml · a14y');
    expect(meta!.description).toBe('Merriam-Webster scores 52/100 for agent readability.');
  });

  it('decodes entities so frontmatter carries text, not markup', async () => {
    const meta = await readRenderedMetadata(distDir, 'leaderboard/mckinsey');
    expect(meta!.title).toContain('McKinsey & Company');
    expect(meta!.description).toContain('McKinsey & Company');
    for (const entity of ['&amp;', '&#38;']) {
      expect(meta!.title).not.toContain(entity);
      expect(meta!.description).not.toContain(entity);
    }
  });

  it('returns null for a route with no built HTML, so the caller can fall back', async () => {
    expect(await readRenderedMetadata(distDir, 'leaderboard/does-not-exist')).toBeNull();
  });

  it('returns null when the page carries neither title nor description', async () => {
    expect(await readRenderedMetadata(distDir, 'leaderboard/bare')).toBeNull();
  });
});
