import * as cheerio from 'cheerio';
import type {
  FetchedPage,
  HttpClient,
  HttpFetchOptions,
  HttpResponse,
} from './types';

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export interface CreateHttpClientOptions {
  /**
   * Override the underlying fetch. Defaults to `globalThis.fetch`, which is
   * present in both Node 18+ and Chrome MV3 service workers — that is the
   * mechanism that lets the CLI and the extension share this client.
   */
  fetchImpl?: FetchImpl;
  /** Default maximum redirect hops to follow. Default 10. */
  defaultMaxRedirects?: number;
  /** Default User-Agent applied to outbound requests. */
  userAgent?: string;
}

const DEFAULT_USER_AGENT = 'agentready/0.2 (+https://github.com/timjordan/agentready)';

export function createHttpClient(opts: CreateHttpClientOptions = {}): HttpClient {
  const fetchImpl: FetchImpl | undefined = opts.fetchImpl ?? (globalThis as { fetch?: FetchImpl }).fetch;
  if (!fetchImpl) {
    throw new Error(
      'createHttpClient: no fetch implementation available. Pass `fetchImpl` or run on a platform with global fetch (Node >=18, modern browsers).',
    );
  }
  const defaultMaxRedirects = opts.defaultMaxRedirects ?? 10;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;

  async function doFetch(url: string, options: HttpFetchOptions = {}): Promise<HttpResponse> {
    const method = options.method ?? 'GET';
    const maxHops = options.maxRedirects ?? defaultMaxRedirects;
    const redirectChain: string[] = [];

    let currentUrl = url;
    let response: Response;
    let hops = 0;

    while (true) {
      response = await fetchImpl!(currentUrl, {
        method,
        headers: { 'user-agent': userAgent, ...(options.headers ?? {}) },
        redirect: 'manual',
        credentials: 'omit',
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        redirectChain.push(currentUrl);
        currentUrl = new URL(location, currentUrl).toString();
        hops++;
        if (hops > maxHops) {
          throw new Error(
            `Too many redirects (${hops}) starting at ${url}; last hop was ${currentUrl}`,
          );
        }
        continue;
      }
      break;
    }

    // For HEAD we still consume the body so the underlying connection can be
    // released, but we return an empty string to keep parity with HEAD semantics.
    const body = method === 'HEAD' ? '' : await response.text();

    return {
      url: currentUrl,
      originalUrl: url,
      status: response.status,
      headers: response.headers,
      body,
      redirectChain,
    };
  }

  async function fetchPage(url: string, options?: HttpFetchOptions): Promise<FetchedPage> {
    const resp = await doFetch(url, options);
    // Cheerio is happy with an empty string; pages that aren't HTML simply
    // produce a $ that finds nothing, which is fine for non-HTML checks.
    const $ = cheerio.load(resp.body);
    return { ...resp, $ };
  }

  return { fetch: doFetch, fetchPage };
}
