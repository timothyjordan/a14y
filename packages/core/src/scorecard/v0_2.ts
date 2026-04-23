import type { ScorecardManifest } from './types';

/**
 * Scorecard v0.2.0 — initial public release.
 *
 * THIS FILE IS FROZEN. Once shipped it is never edited. To change the
 * scorecard, copy this file to v0_3.ts, bump the version, and edit there.
 *
 * Each entry pins a stable check id to a single implementation version.
 * The resolver in `./index.ts` will throw a loud error if any id or version
 * here is missing from the registry, so a frozen scorecard can never
 * silently drift if a check file is renamed or deleted.
 */
export const SCORECARD_0_2_0: ScorecardManifest = {
  version: '0.2.0',
  releasedAt: '2026-04-06',
  description:
    'Initial public scorecard for the Agent Readability Spec. Covers site discoverability (llms.txt, robots.txt, sitemaps, AGENTS.md) and per-page HTML/markdown/code/API checks.',
  checks: {
    // --- site-level (14) ---
    'llms-txt.exists': '1.0.0',
    'llms-txt.content-type': '1.0.0',
    'llms-txt.non-empty': '1.0.0',
    'llms-txt.md-extensions': '1.0.0',
    'robots-txt.exists': '1.0.0',
    'robots-txt.allows-ai-bots': '1.0.0',
    'robots-txt.allows-llms-txt': '1.0.0',
    'sitemap-xml.exists': '1.0.0',
    'sitemap-xml.valid': '1.0.0',
    'sitemap-xml.has-lastmod': '1.0.0',
    'sitemap-md.exists': '1.0.0',
    'sitemap-md.has-structure': '1.0.0',
    'agents-md.exists': '1.0.0',
    'agents-md.has-min-sections': '1.0.0',

    // --- page-level (24) ---
    'http.status-200': '1.0.0',
    'http.redirect-chain': '1.0.0',
    'http.content-type-html': '1.0.0',
    'http.no-noindex-noai': '1.0.0',
    'html.canonical-link': '1.0.0',
    'html.meta-description': '1.0.0',
    'html.og-title': '1.0.0',
    'html.og-description': '1.0.0',
    'html.lang-attribute': '1.0.0',
    'html.json-ld': '1.0.0',
    'html.json-ld.date-modified': '1.0.0',
    'html.json-ld.breadcrumb': '1.0.0',
    'html.headings': '1.0.0',
    'html.text-ratio': '1.0.0',
    'html.glossary-link': '1.0.0',
    'markdown.mirror-suffix': '1.0.0',
    'markdown.alternate-link': '1.0.0',
    'markdown.frontmatter': '1.0.0',
    'markdown.canonical-header': '1.0.0',
    'markdown.content-negotiation': '1.0.0',
    'markdown.sitemap-section': '1.0.0',
    'code.language-tags': '1.0.0',
    'api.schema-link': '1.0.0',
    'discovery.indexed': '1.0.0',
  },
};
