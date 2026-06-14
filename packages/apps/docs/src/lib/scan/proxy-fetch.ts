/**
 * Browser-side fetch adapter that routes @a14y/core's network calls through the
 * scan proxy (see `@a14y/scan-proxy`). This is what lets the website run an
 * audit client-side despite cross-origin CORS.
 *
 * The proxy answers a successful relay with HTTP 200 and the real upstream
 * status in `x-a14y-status`. We rebuild a `Response` carrying that status (and
 * the passed-through `content-type` / `location`) so core's manual redirect
 * handling works exactly as it does in Node and the extension — the browser
 * never auto-follows or opaque-redirects a cross-origin hop.
 *
 * A proxy-level failure (blocked target, rate limit, upstream error, oversized
 * body) comes back WITHOUT `x-a14y-status`; we throw so the widget can surface
 * it rather than feeding core a misleading status.
 */
export type ProxyFetch = (input: string, init?: RequestInit) => Promise<Response>;

// Statuses that must not carry a response body (constructing a Response with a
// body on these throws in the browser).
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

export function createProxyFetch(proxyUrl: string, fetchImpl: ProxyFetch = fetch): ProxyFetch {
  const base = proxyUrl.replace(/\/+$/, '');
  return async (target, init) => {
    const res = await fetchImpl(`${base}/?url=${encodeURIComponent(target)}`, {
      method: init?.method ?? 'GET',
      signal: init?.signal,
      // No credentials, and no `user-agent` (browsers forbid setting it — the
      // proxy stamps the real a14y UA on the upstream request).
    });

    const statusHeader = res.headers.get('x-a14y-status');
    if (statusHeader === null) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 200);
      } catch {
        /* body may be unreadable; the status is enough */
      }
      throw new Error(`scan proxy error ${res.status}${detail ? `: ${detail}` : ''}`);
    }

    const status = Number(statusHeader);
    if (!Number.isInteger(status) || status < 200 || status > 599) {
      throw new Error(`scan proxy returned an invalid x-a14y-status: ${statusHeader}`);
    }

    const body = NULL_BODY_STATUSES.has(status) ? null : await res.text();
    return new Response(body, { status, headers: res.headers });
  };
}
