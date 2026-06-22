import { describe, it, expect } from 'vitest';
import { looksLikeHtml } from '../src/checks/site/_contentType';

// Adversarial test suite authored from the spec only.
// Contract: looksLikeHtml(body: string, contentType?: string): boolean
//  - true when body (after stripping leading BOM, whitespace, and a single
//    leading HTML comment) begins with <!doctype html | <html | <head | <body
//    (case-insensitive).
//  - true when contentType is HTML and body's first non-whitespace char is '<'.
//  - false for real markdown/text even when mislabeled as HTML.
//  - false for a leading HTML comment followed by markdown.
//  - false for empty/whitespace-only body when contentType is not HTML.

const BOM = '﻿';

describe('looksLikeHtml - acceptance criteria from spec', () => {
  it('doctype immediately followed by html tag is HTML', () => {
    expect(looksLikeHtml('<!doctype html><html>...')).toBe(true);
  });

  it('leading whitespace and newline before uppercase doctype is HTML', () => {
    expect(looksLikeHtml('   \n<!DOCTYPE HTML>')).toBe(true);
  });

  it('leading HTML comment then html tag is HTML', () => {
    expect(looksLikeHtml('<!-- shell -->\n<html><body>')).toBe(true);
  });

  it('div fragment with text/html charset contentType is HTML', () => {
    expect(looksLikeHtml('<div id="app"></div>', 'text/html; charset=utf-8')).toBe(true);
  });

  it('markdown body mislabeled text/html is NOT HTML', () => {
    expect(looksLikeHtml('# Sitemap\n- [a](/a.md)', 'text/html')).toBe(false);
  });

  it('robots.txt-style body with no contentType is NOT HTML', () => {
    expect(looksLikeHtml('User-agent: *\nAllow: /')).toBe(false);
  });

  it('leading HTML comment then markdown is NOT HTML', () => {
    expect(looksLikeHtml('<!-- note -->\n# Title')).toBe(false);
  });

  it('empty body is NOT HTML', () => {
    expect(looksLikeHtml('')).toBe(false);
  });
});

describe('looksLikeHtml - HTML document markers via body (no contentType)', () => {
  it('lowercase <!doctype html is HTML', () => {
    expect(looksLikeHtml('<!doctype html>\n<html></html>')).toBe(true);
  });

  it('bare <html> opener is HTML', () => {
    expect(looksLikeHtml('<html lang="en">')).toBe(true);
  });

  it('bare <head> opener is HTML', () => {
    expect(looksLikeHtml('<head><title>x</title></head>')).toBe(true);
  });

  it('bare <body> opener is HTML', () => {
    expect(looksLikeHtml('<body>hello</body>')).toBe(true);
  });

  it('uppercase <HTML> is HTML (case-insensitive)', () => {
    expect(looksLikeHtml('<HTML>')).toBe(true);
  });

  it('mixed-case <Head> is HTML (case-insensitive)', () => {
    expect(looksLikeHtml('<Head>')).toBe(true);
  });

  it('mixed-case <BoDy> is HTML (case-insensitive)', () => {
    expect(looksLikeHtml('<BoDy>')).toBe(true);
  });

  it('fully mixed-case doctype is HTML', () => {
    expect(looksLikeHtml('<!DocType Html>')).toBe(true);
  });
});

describe('looksLikeHtml - leading whitespace / newlines / BOM before markers', () => {
  it('leading spaces before <html> is HTML', () => {
    expect(looksLikeHtml('     <html>')).toBe(true);
  });

  it('leading newlines before <html> is HTML', () => {
    expect(looksLikeHtml('\n\n\n<html>')).toBe(true);
  });

  it('leading tabs and CRLF before doctype is HTML', () => {
    expect(looksLikeHtml('\t\r\n<!doctype html>')).toBe(true);
  });

  it('leading BOM before doctype is HTML', () => {
    expect(looksLikeHtml(BOM + '<!doctype html>')).toBe(true);
  });

  it('leading BOM then whitespace then <html> is HTML', () => {
    expect(looksLikeHtml(BOM + '  \n<html>')).toBe(true);
  });

  it('leading BOM then uppercase doctype is HTML', () => {
    expect(looksLikeHtml(BOM + '<!DOCTYPE HTML>')).toBe(true);
  });
});

describe('looksLikeHtml - leading HTML comment stripping', () => {
  it('comment then whitespace then doctype is HTML', () => {
    expect(looksLikeHtml('<!-- build 123 -->\n  <!doctype html>')).toBe(true);
  });

  it('comment then <head> is HTML', () => {
    expect(looksLikeHtml('<!-- generated -->\n<head></head>')).toBe(true);
  });

  it('BOM then comment then <html> is HTML', () => {
    expect(looksLikeHtml(BOM + '<!-- x -->\n<html>')).toBe(true);
  });

  it('comment then markdown heading is NOT HTML', () => {
    expect(looksLikeHtml('<!-- generated -->\n# Title')).toBe(false);
  });

  it('comment then prose is NOT HTML', () => {
    expect(looksLikeHtml('<!-- auto -->\nHello world, this is a real file.')).toBe(false);
  });

  it('comment then markdown link is NOT HTML', () => {
    expect(looksLikeHtml('<!-- note -->\n[Docs](/index.md)')).toBe(false);
  });
});

describe('looksLikeHtml - HTML contentType with body starting with a tag', () => {
  it('text/html with body whose first non-ws char is < is HTML', () => {
    expect(looksLikeHtml('  \n<section>x</section>', 'text/html')).toBe(true);
  });

  it('text/html; charset=utf-8 with leading-< body is HTML', () => {
    expect(looksLikeHtml('<main></main>', 'text/html; charset=utf-8')).toBe(true);
  });

  it('application/xhtml+xml with leading-< body is HTML', () => {
    expect(looksLikeHtml('<html xmlns="http://www.w3.org/1999/xhtml">', 'application/xhtml+xml')).toBe(true);
  });

  it('text/html with leading whitespace then < is HTML', () => {
    expect(looksLikeHtml('   <div></div>', 'text/html')).toBe(true);
  });
});

describe('looksLikeHtml - mislabeled real files must NOT be rejected', () => {
  it('markdown heading mislabeled text/html is NOT HTML', () => {
    expect(looksLikeHtml('# x', 'text/html')).toBe(false);
  });

  it('robots directive mislabeled text/html is NOT HTML', () => {
    expect(looksLikeHtml('User-agent: *\nAllow: /', 'text/html')).toBe(false);
  });

  it('prose mislabeled text/html is NOT HTML', () => {
    expect(looksLikeHtml('Hello world', 'text/html')).toBe(false);
  });

  it('markdown link mislabeled text/html is NOT HTML', () => {
    expect(looksLikeHtml('[a](/a.md)', 'text/html')).toBe(false);
  });

  it('markdown link mislabeled application/xhtml+xml is NOT HTML', () => {
    expect(looksLikeHtml('[Docs](/index.md)', 'application/xhtml+xml')).toBe(false);
  });

  it('markdown heading mislabeled text/html with charset is NOT HTML', () => {
    expect(looksLikeHtml('# Sitemap\n- [a](/a.md)', 'text/html; charset=utf-8')).toBe(false);
  });
});

describe('looksLikeHtml - empty and whitespace-only bodies', () => {
  it('empty string with no contentType is NOT HTML', () => {
    expect(looksLikeHtml('')).toBe(false);
  });

  it('whitespace-only body with no contentType is NOT HTML', () => {
    expect(looksLikeHtml('   \n\t  ')).toBe(false);
  });

  it('whitespace-only body with non-HTML contentType is NOT HTML', () => {
    expect(looksLikeHtml('   \n  ', 'text/plain')).toBe(false);
  });

  it('whitespace-only body with markdown contentType is NOT HTML', () => {
    expect(looksLikeHtml('  ', 'text/markdown')).toBe(false);
  });

  it('BOM-only body with no contentType is NOT HTML', () => {
    expect(looksLikeHtml(BOM)).toBe(false);
  });

  it('empty body with non-HTML contentType is NOT HTML', () => {
    expect(looksLikeHtml('', 'text/plain')).toBe(false);
  });
});

describe('looksLikeHtml - tricky true-negatives', () => {
  it('markdown that merely mentions html later is NOT HTML', () => {
    expect(looksLikeHtml('# Guide\n\nLater we will discuss the <html> tag in detail.')).toBe(false);
  });

  it('fenced code block containing <html> not at very start is NOT HTML', () => {
    expect(looksLikeHtml('# Example\n\n```html\n<html></html>\n```\n')).toBe(false);
  });

  it('text with < mid-body and non-HTML contentType is NOT HTML', () => {
    expect(looksLikeHtml('a < b is a comparison', 'text/plain')).toBe(false);
  });

  it('text with < mid-body and no contentType is NOT HTML', () => {
    expect(looksLikeHtml('value is x < y here')).toBe(false);
  });

  it('markdown body with non-HTML contentType even though it contains tags later is NOT HTML', () => {
    expect(looksLikeHtml('# Title\n\n<div>not at start</div>', 'text/markdown')).toBe(false);
  });

  it('plain text body whose first char is not < is NOT HTML even with text/html', () => {
    expect(looksLikeHtml('plain <span>text</span>', 'text/html')).toBe(false);
  });

  it('xml declaration only (not an html marker) without HTML contentType is NOT HTML', () => {
    expect(looksLikeHtml('<?xml version="1.0"?>')).toBe(false);
  });

  it('arbitrary non-html tag at start without HTML contentType is NOT HTML', () => {
    expect(looksLikeHtml('<rss version="2.0"></rss>')).toBe(false);
  });
});

describe('looksLikeHtml - body-only decisions when contentType omitted', () => {
  it('html marker decides true without contentType', () => {
    expect(looksLikeHtml('<!doctype html>')).toBe(true);
  });

  it('markdown decides false without contentType', () => {
    expect(looksLikeHtml('# Heading')).toBe(false);
  });

  it('leading < of a non-html-marker tag is NOT HTML without HTML contentType', () => {
    expect(looksLikeHtml('<svg></svg>')).toBe(false);
  });
});
