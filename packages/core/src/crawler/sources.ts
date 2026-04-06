import { loadLlmsTxt } from '../checks/site/llmsTxt';
import { loadSitemapMd } from '../checks/site/sitemapMd';
import { loadSitemapXml } from '../checks/site/sitemapXml';
import type { SiteCheckContext } from '../scorecard/types';

export type DiscoverySource = 'sitemap-xml' | 'llms-txt' | 'sitemap-md' | 'crawl';

export interface SeedCollection {
  /** All discovered seed URLs, normalized and deduped. */
  urls: Set<string>;
  /** For each URL, which seed sources announced it. */
  bySource: Map<string, Set<DiscoverySource>>;
}

/**
 * Fetch every seed file in parallel and merge their advertised URLs into a
 * single deduped set. The site checks read from the same shared map keys
 * so each resource is fetched at most once per run.
 */
export async function collectSeeds(ctx: SiteCheckContext): Promise<SeedCollection> {
  const [llms, xml, md] = await Promise.all([
    loadLlmsTxt(ctx),
    loadSitemapXml(ctx),
    loadSitemapMd(ctx),
  ]);

  const urls = new Set<string>();
  const bySource = new Map<string, Set<DiscoverySource>>();

  const add = (raw: string, source: DiscoverySource) => {
    let normalized: string;
    try {
      normalized = new URL(raw, ctx.baseUrl).toString();
    } catch {
      return;
    }
    urls.add(normalized);
    let bucket = bySource.get(normalized);
    if (!bucket) {
      bucket = new Set();
      bySource.set(normalized, bucket);
    }
    bucket.add(source);
  };

  if (xml.found && xml.urls) {
    for (const u of xml.urls) add(u, 'sitemap-xml');
  }
  if (llms.found && llms.links) {
    for (const u of llms.links) add(u, 'llms-txt');
  }
  if (md.found && md.body) {
    const linkRe = /\[[^\]]+\]\(([^)\s]+)/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(md.body)) !== null) add(m[1], 'sitemap-md');
  }

  return { urls, bySource };
}
