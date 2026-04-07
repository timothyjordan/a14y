import type { FetchedPage, HttpClient } from '../fetch/types';
import type { SiteCheckContext } from '../scorecard/types';
import { collectSeeds, type DiscoverySource, type SeedCollection } from './sources';
import { extractSameOriginLinks } from './linkExtract';
import { ConcurrentQueue } from './queue';

export type { DiscoverySource } from './sources';

export interface DiscoveredPage {
  url: string;
  page: FetchedPage;
  /** Which seed sources (or "crawl") surfaced this URL. */
  sources: Set<DiscoverySource>;
}

export interface CrawlOptions {
  /** Site to crawl, e.g. "https://example.com". */
  baseUrl: string;
  http: HttpClient;
  /**
   * Pre-built site context. The crawler reuses its `shared` map so the
   * site-level seed loaders (llms.txt, sitemap.xml, sitemap.md) only run
   * once per audit even though both the crawler and the site checks call
   * them.
   */
  siteCtx: SiteCheckContext;
  /**
   * URL the crawler should always visit even if no seed source mentions
   * it. Defaults to the origin root of `baseUrl` (`https://host/`). Pass
   * the user-provided audit URL here so subpath-hosted sites
   * (`https://host/docs/`) actually get crawled instead of bouncing off
   * a 404 at the origin root.
   */
  entryUrl?: string;
  maxPages?: number;
  concurrency?: number;
  /** Minimum delay between successive request starts (politeness). */
  politeDelayMs?: number;
  /** Called whenever a page is discovered or finished. */
  onProgress?: (event: CrawlProgressEvent) => void;
}

export type CrawlProgressEvent =
  | { type: 'seeds-collected'; count: number }
  | { type: 'page-fetched'; url: string; visited: number; queued: number }
  | { type: 'page-error'; url: string; error: string };

const DEFAULTS = {
  maxPages: 500,
  concurrency: 8,
  politeDelayMs: 250,
};

/**
 * Stream every reachable page on the site as soon as it has been fetched.
 * Discovery is seeded from sitemap.xml / llms.txt / sitemap.md (in
 * parallel) and then expanded by following same-origin links from each
 * fetched HTML page. Pages are deduped by URL, capped by `maxPages`, and
 * fetched through a fixed-size worker pool.
 */
export async function* crawlSite(opts: CrawlOptions): AsyncIterable<DiscoveredPage> {
  const max = opts.maxPages ?? DEFAULTS.maxPages;
  const concurrency = opts.concurrency ?? DEFAULTS.concurrency;
  const politeDelayMs = opts.politeDelayMs ?? DEFAULTS.politeDelayMs;
  const queue = new ConcurrentQueue({ concurrency, politeDelayMs });

  const seeds: SeedCollection = await collectSeeds(opts.siteCtx);
  opts.onProgress?.({ type: 'seeds-collected', count: seeds.urls.size });

  const seen = new Set<string>();
  const seedSources: Map<string, Set<DiscoverySource>> = new Map(seeds.bySource);

  // Always include the entry URL so single-page-or-no-seed sites still
  // produce at least one DiscoveredPage. For subpath-hosted sites the
  // entry URL preserves the user's pathname (e.g. `/agentready/`) so
  // the crawler doesn't bounce off the origin root, which may 404 if
  // the audited subpath isn't owned at the top-level domain.
  const entryUrl =
    opts.entryUrl !== undefined
      ? new URL(opts.entryUrl).toString()
      : new URL('/', opts.baseUrl).toString();
  if (!seedSources.has(entryUrl)) {
    seedSources.set(entryUrl, new Set(['crawl']));
  }

  // Buffer + signal pattern to bridge the queue's task callbacks into the
  // async iterator we yield from.
  const buffer: DiscoveredPage[] = [];
  let waiter: (() => void) | null = null;
  let done = false;
  let error: Error | null = null;
  const pushBuffered = (page: DiscoveredPage) => {
    buffer.push(page);
    if (waiter) {
      const w = waiter;
      waiter = null;
      w();
    }
  };
  const wake = () => {
    if (waiter) {
      const w = waiter;
      waiter = null;
      w();
    }
  };

  const visit = (url: string, sources: Set<DiscoverySource>) => {
    if (seen.has(url) || seen.size >= max) return;
    seen.add(url);
    queue.add(async () => {
      try {
        const page = await opts.http.fetchPage(url);
        const result: DiscoveredPage = { url: page.url, page, sources };
        pushBuffered(result);
        opts.onProgress?.({
          type: 'page-fetched',
          url: page.url,
          visited: seen.size,
          queued: queue['active'] + queue['pending'].length,
        });
        // Expand from this page's links, tagging them as crawl-discovered.
        const links = extractSameOriginLinks(page, opts.baseUrl);
        for (const link of links) {
          if (seen.size >= max) break;
          const tag = seedSources.get(link) ?? new Set<DiscoverySource>(['crawl']);
          visit(link, tag);
        }
      } catch (e) {
        opts.onProgress?.({
          type: 'page-error',
          url,
          error: (e as Error).message,
        });
      }
    });
  };

  // Seed the queue from every announced URL.
  for (const url of seedSources.keys()) {
    if (seen.size >= max) break;
    visit(url, seedSources.get(url) ?? new Set(['crawl']));
  }

  // Run the queue to completion in the background, then signal done.
  queue
    .onIdle()
    .then(() => {
      done = true;
      wake();
    })
    .catch((e) => {
      error = e as Error;
      done = true;
      wake();
    });

  // Yield buffered pages until the queue is fully drained.
  while (true) {
    if (error) throw error;
    if (buffer.length > 0) {
      yield buffer.shift()!;
      continue;
    }
    if (done) return;
    await new Promise<void>((r) => {
      waiter = r;
    });
  }
}

/** Convenience: collect every page into an array. */
export async function crawlSiteToArray(opts: CrawlOptions): Promise<DiscoveredPage[]> {
  const out: DiscoveredPage[] = [];
  for await (const p of crawlSite(opts)) out.push(p);
  return out;
}
