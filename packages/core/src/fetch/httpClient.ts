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
  /**
   * Default per-request timeout in milliseconds. Aborts the underlying fetch
   * if a single hop exceeds it. Default 60_000 (60s) — long enough not to
   * trip on slow-but-valid servers, short enough that one stalled connection
   * cannot pin a worker indefinitely.
   */
  defaultTimeoutMs?: number;
}

const DEFAULT_USER_AGENT = 'a14y/0.2 (+https://github.com/timothyjordan/a14y)';
const DEFAULT_TIMEOUT_MS = 60_000;

export function createHttpClient(opts: CreateHttpClientOptions = {}): HttpClient {
  const fetchImpl: FetchImpl | undefined = opts.fetchImpl ?? (globalThis as { fetch?: FetchImpl }).fetch;
  if (!fetchImpl) {
    throw new Error(
      'createHttpClient: no fetch implementation available. Pass `fetchImpl` or run on a platform with global fetch (Node >=18, modern browsers).',
    );
  }
  const defaultMaxRedirects = opts.defaultMaxRedirects ?? 10;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const defaultTimeoutMs = opts.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function doFetch(url: string, options: HttpFetchOptions = {}): Promise<HttpResponse> {
    const method = options.method ?? 'GET';
    const maxHops = options.maxRedirects ?? defaultMaxRedirects;
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
    const redirectChain: string[] = [];

    let currentUrl = url;
    let hops = 0;

    while (true) {
      // Re-arm the timeout per hop. A redirect chain that bounces through a
      // stalled host can't escape the per-request budget that way. The signal
      // also covers the body read below — some servers (e.g. Google sitemap
      // children under non-browser UAs) accept the connection then drip the
      // body out over many seconds, which would hang otherwise.
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const response = await fetchImpl!(currentUrl, {
          method,
          headers: { 'user-agent': userAgent, ...(options.headers ?? {}) },
          redirect: 'manual',
          credentials: 'omit',
          signal: ac.signal,
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location) {
            redirectChain.push(currentUrl);
            currentUrl = new URL(location, currentUrl).toString();
            hops++;
            if (hops > maxHops) {
              throw new Error(
                `Too many redirects (${hops}) starting at ${url}; last hop was ${currentUrl}`,
              );
            }
            // Drain any redirect body so the connection can be reused, then
            // loop to the next hop with a fresh timer.
            try {
              await response.text();
            } catch {
              // Some platforms surface body-read errors on a 3xx with empty
              // body; the redirect target is what matters.
            }
            continue;
          }
        }

        // For HEAD we still consume the body so the underlying connection can
        // be released, but we return an empty string to keep parity with HEAD.
        const body = method === 'HEAD' ? '' : await response.text();

        return {
          url: currentUrl,
          originalUrl: url,
          status: response.status,
          headers: response.headers,
          body,
          redirectChain,
        };
      } catch (e) {
        if (ac.signal.aborted) {
          throw new Error(
            `Request to ${currentUrl} exceeded ${timeoutMs}ms timeout`,
          );
        }
        throw e;
      } finally {
        clearTimeout(timer);
      }
    }
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
