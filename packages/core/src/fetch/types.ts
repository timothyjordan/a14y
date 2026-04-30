import type { CheerioAPI } from 'cheerio';

/**
 * Universal fetched-page representation. Produced by httpClient.fetchPage and
 * consumed by every page-level check. Works the same in Node and in an MV3
 * service worker so that the CLI and Chrome extension see identical inputs.
 */
export interface FetchedPage {
  /** Final URL after following redirects. */
  url: string;
  /** URL originally requested. */
  originalUrl: string;
  /** Final HTTP status. */
  status: number;
  /** Response headers (lowercased keys via Headers API). */
  headers: Headers;
  /** Raw response body. */
  body: string;
  /** Cheerio handle over `body`. May be unused for non-HTML responses. */
  $: CheerioAPI;
  /**
   * Ordered list of intermediate URLs visited before reaching `url`.
   * Length 0 means no redirects; length N means N hops.
   */
  redirectChain: string[];
}

export interface HttpFetchOptions {
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
  /** Maximum redirects to follow before giving up. Default 10. */
  maxRedirects?: number;
  /**
   * Per-request timeout in milliseconds. Aborts the underlying fetch (and is
   * re-armed on each redirect hop) so a stalled connection cannot pin a
   * worker. Defaults to the client-level `defaultTimeoutMs`.
   */
  timeoutMs?: number;
}

export interface HttpResponse {
  url: string;
  originalUrl: string;
  status: number;
  headers: Headers;
  body: string;
  redirectChain: string[];
}

/**
 * Minimal HTTP client interface. Implementations exist for Node fetch and the
 * MV3 service-worker fetch; both follow this contract so checks are
 * environment-agnostic.
 */
export interface HttpClient {
  fetch(url: string, options?: HttpFetchOptions): Promise<HttpResponse>;
  fetchPage(url: string, options?: HttpFetchOptions): Promise<FetchedPage>;
}
