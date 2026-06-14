import {
  ALLOWED_ORIGINS,
  EXPOSED_HEADERS,
  MAX_BODY_BYTES,
  PROXY_USER_AGENT,
  UPSTREAM_TIMEOUT_MS,
} from './config.js';
import type { RateLimiter } from './rate-limit.js';
import { validateTargetUrl } from './validate.js';

export interface ProxyDeps {
  /** Override the upstream fetch (tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Optional per-IP limiter. When omitted, no limiting is applied. */
  rateLimiter?: RateLimiter;
  /** Override the body cap (tests). Defaults to MAX_BODY_BYTES. */
  maxBodyBytes?: number;
}

/**
 * The whole proxy, as a single Web-standard request handler. The Node server
 * in `server.ts` is just a thin adapter around this; tests exercise it directly
 * with real Request/Response objects.
 *
 * Contract with the browser client (`createProxyFetch` in the docs app):
 *   - A *successful relay* always returns HTTP 200 and carries the real
 *     upstream status in `x-a14y-status` (even for upstream 404/500/3xx). The
 *     client rebuilds a Response from that so @a14y/core's manual redirect
 *     handling keeps working without the browser auto-following cross-origin.
 *   - A *proxy-level error* (bad target, method, rate limit, upstream failure,
 *     oversized body) returns a non-200 WITHOUT `x-a14y-status`, which the
 *     client treats as a hard failure to surface to the user.
 */
export async function handleProxy(request: Request, deps: ProxyDeps = {}): Promise<Response> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const maxBodyBytes = deps.maxBodyBytes ?? MAX_BODY_BYTES;
  const cors = corsHeaders(request.headers.get('origin'));

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  const url = new URL(request.url);
  if (url.pathname === '/healthz') {
    return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return proxyError(405, 'method not allowed', cors);
  }

  if (deps.rateLimiter && !deps.rateLimiter.take(clientIp(request))) {
    return proxyError(429, 'rate limit exceeded', cors);
  }

  const target = validateTargetUrl(url.searchParams.get('url'));
  if (!target.ok) {
    return proxyError(400, target.reason, cors);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetchImpl(target.url.toString(), {
      method: request.method,
      headers: { 'user-agent': PROXY_USER_AGENT },
      redirect: 'manual',
      credentials: 'omit',
      signal: controller.signal,
    });
  } catch {
    return proxyError(502, 'upstream fetch failed', cors);
  } finally {
    clearTimeout(timer);
  }

  let body: Uint8Array | null = null;
  if (request.method !== 'HEAD') {
    const read = await readCapped(upstream, maxBodyBytes);
    if (read.truncated) {
      return proxyError(413, 'response too large', cors);
    }
    body = read.bytes;
  } else {
    await upstream.body?.cancel();
  }

  const headers = new Headers(cors);
  headers.set('x-a14y-status', String(upstream.status));
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const location = upstream.headers.get('location');
  if (location) headers.set('location', location);
  headers.set('access-control-expose-headers', EXPOSED_HEADERS);
  // Always 200 to the client; the real status rides in x-a14y-status.
  // Cast: undici's Response accepts a Uint8Array body at runtime; the
  // lib.dom BodyInit type just doesn't model Node's generic typed arrays.
  return new Response(body as BodyInit | null, { status: 200, headers });
}

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    vary: 'Origin',
  });
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers.set('access-control-allow-origin', origin);
  }
  return headers;
}

function proxyError(status: number, reason: string, cors: Headers): Response {
  const headers = new Headers(cors);
  headers.set('content-type', 'text/plain; charset=utf-8');
  return new Response(reason, { status, headers });
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

async function readCapped(
  resp: Response,
  cap: number,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!resp.body) {
    const bytes = new Uint8Array(await resp.arrayBuffer());
    return { bytes, truncated: bytes.byteLength > cap };
  }
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      return { bytes: new Uint8Array(0), truncated: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, truncated: false };
}
