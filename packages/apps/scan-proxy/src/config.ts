/** Origins allowed to call the proxy from a browser (CORS allow-list). */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://a14y.dev',
  'https://baseline.a14y.dev',
  'http://localhost:4321', // docs dev server (astro default)
  'http://localhost:4322', // docs baseline dev server
  'http://localhost:3000', // alternate docs dev port
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

/** Token-bucket rate limit applied per client IP.
 *
 *  One page-mode audit fans out into ~20-40 well-known probes (the page plus
 *  robots.txt / llms.txt / sitemap / AGENTS.md and their variants), so the
 *  burst capacity must sit comfortably above a single scan or normal use trips
 *  it. The refill rate is what actually throttles sustained abuse; the hard
 *  cost ceiling is Cloud Run `--max-instances`. */
export const RATE_LIMIT_CAPACITY = 150;
export const RATE_LIMIT_REFILL_PER_SEC = 5;
