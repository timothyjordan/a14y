import { describe, expect, it } from 'vitest';
import {
  resolvePagesSlug,
  renderShippedVersionsList,
  renderScorecardVersionChecks,
  renderScorecardDiffSection,
  renderDraftChangesPage,
} from '../src/integrations/markdown-mirrors';
import {
  getDraftScorecardVersion,
  getLatestScorecardVersion,
} from '../src/lib/scorecard-data';

describe('markdown-mirrors helpers', () => {
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

    it('renders a Methodology subheading linking both methodology pages', () => {
      // The draft pins per-check-mean-v1 vs v0.2.0's flat-pool-v1 (PR #53).
      // The change must surface as its own subsection so an agent reading the
      // .md mirror sees the same algorithm-change context the HTML page shows.
      const out = renderScorecardDiffSection(getDraftScorecardVersion());
      expect(out).toMatch(/^### Methodology/m);
      expect(out).toContain('/scorecards/methodologies/flat-pool-v1/');
      expect(out).toContain('/scorecards/methodologies/per-check-mean-v1/');
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

    it('emits a Methodology bullet linking both methodology pages', () => {
      const out = renderDraftChangesPage(getDraftScorecardVersion());
      expect(out).toContain('**Methodology**');
      expect(out).toContain('/scorecards/methodologies/flat-pool-v1/');
      expect(out).toContain('/scorecards/methodologies/per-check-mean-v1/');
    });
  });

});
