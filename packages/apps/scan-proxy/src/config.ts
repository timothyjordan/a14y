/** Origins allowed to call the proxy from a browser (CORS allow-list). */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://a14y.dev',
  'https://baseline.a14y.dev',
  'http://localhost:4321', // docs dev server (astro default)
  'http://localhost:4322', // docs baseline dev server
  'http://localhost:3000', // alternate docs dev port
];

/** Env var holding extra dev-only origins, comma-separated. */
export const EXTRA_ORIGINS_ENV = 'PROXY_EXTRA_ORIGINS';

/**
 * Parse the comma-separated `PROXY_EXTRA_ORIGINS` value into a clean origin
 * list: trimmed, with blanks dropped. Empty/undefined yields an empty list, so
 * the allow-list stays exactly `ALLOWED_ORIGINS` unless the operator opts in.
 */
export function parseExtraOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/**
 * The effective CORS allow-list for a given environment: the hardcoded
 * `ALLOWED_ORIGINS` plus any `PROXY_EXTRA_ORIGINS` entries, de-duplicated.
 * Production leaves the env var unset, so the result equals `ALLOWED_ORIGINS`.
 */
export function resolveAllowedOrigins(
  env: { [key: string]: string | undefined } = {},
): readonly string[] {
  return [...new Set([...ALLOWED_ORIGINS, ...parseExtraOrigins(env[EXTRA_ORIGINS_ENV])])];
}

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
