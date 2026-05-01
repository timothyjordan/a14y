import { describe, expect, it } from 'vitest';
import {
  resolvePagesSlug,
  renderShippedVersionsList,
  renderScorecardVersionChecks,
} from '../src/integrations/markdown-mirrors';
import { getLatestScorecardVersion } from '../src/lib/scorecard-data';

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
      expect(resolvePagesSlug('privacy')).toBe('privacy');
      expect(resolvePagesSlug('scorecards')).toBe('scorecards');
    });

    it('maps any /scorecards/<version>/ to "scorecards-version"', () => {
      expect(resolvePagesSlug('scorecards/0.2.0')).toBe('scorecards-version');
      expect(resolvePagesSlug('scorecards/1.0.0')).toBe('scorecards-version');
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
  });

});
