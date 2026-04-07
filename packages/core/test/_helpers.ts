import * as cheerio from 'cheerio';
import type {
  HttpClient,
  HttpFetchOptions,
  HttpResponse,
  FetchedPage,
} from '../src/fetch/types';
import type {
  PageCheckContext,
  SiteCheckContext,
} from '../src/scorecard/types';

export interface FakeRoute {
  /** Body to return. */
  body?: string;
  status?: number;
  headers?: Record<string, string>;
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
  return {
    async fetch(url: string, _options?: HttpFetchOptions) {
      return buildResponse(url);
    },
    async fetchPage(url: string, _options?: HttpFetchOptions): Promise<FetchedPage> {
      const resp = buildResponse(url);
      return { ...resp, $: cheerio.load(resp.body) };
    },
  };
}

export function makeSiteCtx(baseUrl: string, routes: Record<string, FakeRoute>): SiteCheckContext {
  return {
    scope: 'site',
    baseUrl,
    http: fakeHttpClient(routes),
    shared: new Map(),
  };
}

export function makePageCtx(
  baseUrl: string,
  url: string,
  body: string,
  headers: Record<string, string> = {},
  routes: Record<string, FakeRoute> = {},
): PageCheckContext {
  const $ = cheerio.load(body);
  const page: FetchedPage = {
    url,
    originalUrl: url,
    status: 200,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8', ...headers }),
    body,
    $,
    redirectChain: [],
  };
  return {
    scope: 'page',
    baseUrl,
    http: fakeHttpClient(routes),
    shared: new Map(),
    url,
    page,
  };
}
