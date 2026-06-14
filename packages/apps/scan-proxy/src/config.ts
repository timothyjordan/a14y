/** Origins allowed to call the proxy from a browser (CORS allow-list). */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://a14y.dev',
  'https://baseline.a14y.dev',
  'http://localhost:3000', // docs dev server
  'http://localhost:4322', // docs baseline dev server
];

/** Largest upstream body we will relay, in bytes. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

/** Per-request timeout for the upstream fetch, in milliseconds. */
export const UPSTREAM_TIMEOUT_MS = 30_000;

/** User-Agent we present to upstream sites. Browsers forbid scripts from
 *  setting `user-agent`, so the proxy stamps the real a14y UA here. */
export const PROXY_USER_AGENT = 'a14y/0.4 (+https://github.com/timothyjordan/a14y)';

/** Headers the browser is allowed to read off the proxied response. */
export const EXPOSED_HEADERS = 'x-a14y-status, content-type, location';

/** Token-bucket rate limit applied per client IP. */
export const RATE_LIMIT_CAPACITY = 30;
export const RATE_LIMIT_REFILL_PER_SEC = 1;
