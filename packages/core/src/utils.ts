/**
 * Backwards-compatibility shim. The canonical fetch implementation lives in
 * `./fetch/httpClient.ts`. This file forwards to a default client so older
 * call sites (legacy `checks/*`, `llmstxt.ts`, `robots.ts`) keep building
 * until the runner rewrite (TJ-99) replaces them.
 */
import { createHttpClient } from './fetch/httpClient';
import type { FetchedPage } from './fetch/types';

export type { FetchedPage } from './fetch/types';

const _defaultClient = createHttpClient();

export async function fetchPage(url: string): Promise<FetchedPage> {
  return _defaultClient.fetchPage(url);
}
