import type {
  HttpClient,
  HttpFetchOptions,
  HttpResponse,
  FetchedPage,
} from '../src/fetch/types';
import { makeFetchedPage } from '../src/fetch/httpClient';
import type {
  PageCheckContext,
  SiteCheckContext,
} from '../src/scorecard/types';

export interface FakeRoute {
  /** Body to return. */
  body?: string;
  status?: number;
  headers?: Record<string, string>;
  /**
   * Optional per-route delay (ms) applied before `fetch`/`fetchPage`
   * resolves. Used by backpressure tests to keep fetch workers from
   * resolving in the same microtask. Defaults to 0 (synchronous-ish).
   */
  delayMs?: number;
}

/**
 * Build an in-memory HttpClient. The route map is keyed by full URL; missing
 * URLs return 404. Used by every check unit test so we don't touch the network.
 */
export function fakeHttpClient(routes: Record<string, FakeRoute>): HttpClient {
  const get = (url: string): FakeRoute => routes[url] ?? { status: 404, body: '' };
  const buildResponse = (url: string): HttpResponse => {
    const r = get(url);
    return {
      url,
      originalUrl: url,
      status: r.status ?? 200,
      headers: new Headers(r.headers ?? {}),
      body: r.body ?? '',
      redirectChain: [],
    };
  };
  const maybeDelay = async (url: string): Promise<void> => {
    const delay = get(url).delayMs ?? 0;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  };
  return {
    async fetch(url: string, _options?: HttpFetchOptions) {
      await maybeDelay(url);
      return buildResponse(url);
    },
    async fetchPage(url: string, _options?: HttpFetchOptions): Promise<FetchedPage> {
      await maybeDelay(url);
      return makeFetchedPage(buildResponse(url));
    },
  };
}

export function makeSiteCtx(
  baseUrl: string,
  routes: Record<string, FakeRoute>,
  sitePrefix?: string,
): SiteCheckContext {
  return {
    scope: 'site',
    baseUrl,
    http: fakeHttpClient(routes),
    shared: new Map(),
    sitePrefix,
  };
}

export function makePageCtx(
  baseUrl: string,
  url: string,
  body: string,
  headers: Record<string, string> = {},
  routes: Record<string, FakeRoute> = {},
): PageCheckContext {
  const page: FetchedPage = makeFetchedPage({
    url,
    originalUrl: url,
    status: 200,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8', ...headers }),
    body,
    redirectChain: [],
  });
  return {
    scope: 'page',
    baseUrl,
    http: fakeHttpClient(routes),
    shared: new Map(),
    url,
    page,
  };
}
