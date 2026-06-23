/**
 * Detect whether an HTTP response body is an HTML document rather than the
 * plain-text / markdown file we requested.
 *
 * Discovery files (sitemap.md, AGENTS.md, llms.txt, ...) are frequently
 * "soft-200" served: a single-page-app shell or a styled 404 page returns HTTP
 * 200 with an HTML body at the file's path. Counting those as the file inflates
 * adoption stats, so the hardened `*.exists` checks use this to reject them.
 *
 * Returns true when the body clearly begins as an HTML document, or when the
 * Content-Type is HTML and the body starts with a tag. A real markdown/text
 * file (starting with `#`, `User-agent:`, prose, a link, etc.) returns false
 * even when the server mislabels its Content-Type, so a correctly published
 * file is never rejected.
 */
export function looksLikeHtml(body: string, contentType?: string): boolean {
  // Drop a BOM, leading whitespace, and a single leading HTML comment (some
  // app shells emit `<!-- … -->` before the doctype). Stripping the comment
  // also means a markdown file that merely opens with an HTML comment is not
  // mistaken for an HTML document.
  const head = body
    .replace(/^﻿/, '')
    .replace(/^\s+/, '')
    .replace(/^<!--[\s\S]*?-->\s*/, '')
    .slice(0, 1024)
    .toLowerCase();

  if (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.startsWith('<head') ||
    head.startsWith('<body')
  ) {
    return true;
  }

  const ct = (contentType ?? '').toLowerCase();
  const ctIsHtml = ct.includes('text/html') || ct.includes('application/xhtml');
  return ctIsHtml && head.startsWith('<');
}
