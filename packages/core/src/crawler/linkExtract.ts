import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { FetchedPage } from '../fetch/types';

/** Markdown-shaped pathname (`.md` / `.mdx`). */
const MARKDOWN_PATH_RE = /\.(md|mdx)(\?|$)/i;

/**
 * Markdown fenced code block: lines opened by 3+ backticks or tildes, an
 * optional info string, then matched closing fence. Greedy across newlines.
 */
const MD_FENCED_BLOCK_RE = /(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[ \t]*(?=\n|$)/g;

/** Markdown inline code span: `` `code` `` or `` ``code`` ``. */
const MD_INLINE_CODE_RE = /`+[^`\n]+`+/g;

function looksLikeMarkdown(page: FetchedPage): boolean {
  const ct = (page.headers.get('content-type') ?? '').toLowerCase();
  if (ct.startsWith('text/markdown')) return true;
  try {
    return MARKDOWN_PATH_RE.test(new URL(page.url).pathname);
  } catch {
    return false;
  }
}

function stripMarkdownExamples(body: string): string {
  return body.replace(MD_FENCED_BLOCK_RE, '\n').replace(MD_INLINE_CODE_RE, '');
}

/**
 * Pull every same-origin <a href> off a fetched page, normalizing relative
 * URLs and stripping URL fragments. Hosts must match the supplied origin
 * exactly so the crawler never wanders off-site.
 *
 * Anchors that appear *inside* example regions are skipped — they are
 * documentation, not navigation. Two shapes of "example" are detected:
 *
 *   1. Rendered HTML: <a> whose ancestor chain includes <pre>, <code>,
 *      <samp>, or <kbd>.
 *   2. Raw markdown: <a> tags that live inside fenced code blocks
 *      (```...``` or ~~~...~~~) or inline code spans (`...`). Cheerio
 *      doesn't model markdown fences, so when the response looks like
 *      markdown we strip those regions from a *copy* of the body before
 *      building a temporary Cheerio root for link discovery. The original
 *      page.$ / page.body are never mutated, so checks like
 *      code.language-tags continue to see the original document.
 */
export function extractSameOriginLinks(page: FetchedPage, origin: string): string[] {
  const out = new Set<string>();
  const originUrl = new URL(origin);

  let $: CheerioAPI;
  if (looksLikeMarkdown(page)) {
    $ = cheerio.load(stripMarkdownExamples(page.body));
  } else {
    $ = page.$;
  }

  $('a[href]').each((_, el) => {
    if ($(el).closest('pre, code, samp, kbd').length > 0) return;
    const raw = $(el).attr('href');
    if (!raw) return;
    let abs: URL;
    try {
      abs = new URL(raw, page.url);
    } catch {
      return;
    }
    if (abs.host !== originUrl.host) return;
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;
    abs.hash = '';
    out.add(abs.toString());
  });
  return [...out];
}
