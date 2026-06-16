/**
 * Base URL of the deployed scan proxy (`@a14y/scan-proxy` on Cloud Run),
 * supplied at build time via the `PUBLIC_SCAN_PROXY_URL` env var.
 *
 * Empty when unconfigured; the scan widget then shows a "not available"
 * message instead of failing obscurely. Local dev points this at the proxy's
 * `npm run dev` server (`http://localhost:8787`).
 */
export const SCAN_PROXY_URL: string = (
  (import.meta.env.PUBLIC_SCAN_PROXY_URL as string | undefined) ?? ''
).trim();

export function isScanConfigured(): boolean {
  return SCAN_PROXY_URL.length > 0;
}
