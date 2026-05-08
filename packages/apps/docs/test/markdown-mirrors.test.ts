import { describe, expect, it } from 'vitest';
import {
  HTML_DERIVED_PAGES,
  resolvePagesSlug,
  renderShippedVersionsList,
  renderScorecardVersionChecks,
} from '../src/integrations/markdown-mirrors';
import { getLatestScorecardVersion } from '../src/lib/scorecard-data';

describe('markdown-mirrors helpers', () => {
  describe('HTML_DERIVED_PAGES', () => {
    it('registers each design-heavy page so its mirror is generated via Turndown', () => {
      // Pages whose canonical source is .astro (too much bespoke
      // markup to express cleanly as markdown) must be listed here
      // so the integration reads the rendered HTML for the mirror.
      // Missing entries silently fall back to the legacy stub mirror,
      // which loses the page's actual prose.
      expect(HTML_DERIVED_PAGES['']).toBe('index.html');
      expect(HTML_DERIVED_PAGES['spec']).toBe('spec/index.html');
      expect(HTML_DERIVED_PAGES['about']).toBe('about/index.html');
      expect(HTML_DERIVED_PAGES['chrome-extension']).toBe(
        'chrome-extension/index.html',
      );
    });
  });

  describe('resolvePagesSlug', () => {
    it('returns null for HTML-derived pages (index, spec, about)', () => {
      // The landing page, /spec/, and /about/ are authored as .astro
      // and have their mirrors generated via Turndown from the
      // rendered HTML — not from a `pages` collection entry.
      expect(resolvePagesSlug('')).toBeNull();
      expect(resolvePagesSlug('spec')).toBeNull();
      expect(resolvePagesSlug('about')).toBeNull();
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
