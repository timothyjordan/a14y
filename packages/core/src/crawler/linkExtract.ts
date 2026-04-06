import type { FetchedPage } from '../fetch/types';

/**
 * Pull every same-origin <a href> off a fetched page, normalizing relative
 * URLs and stripping URL fragments. Hosts must match the supplied origin
 * exactly so the crawler never wanders off-site.
 */
export function extractSameOriginLinks(page: FetchedPage, origin: string): string[] {
  const out = new Set<string>();
  const originUrl = new URL(origin);
  page.$('a[href]').each((_, el) => {
    const raw = page.$(el).attr('href');
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
