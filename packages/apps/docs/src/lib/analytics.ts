/**
 * Tiny client-side analytics helper for the docs site. Wraps the gtag.js
 * instance set up in `Analytics.astro`.
 *
 * `window.gtag` only exists when the visitor has NOT opted out
 * (`localStorage 'a14y:ga-opt-out'`) and DNT is off, because Analytics.astro
 * skips loading GA entirely in those cases. So every send goes through
 * `trackEvent`, which no-ops when gtag is absent. There is no separate consent
 * gate to manage here.
 *
 * Convention (matches the existing `docs_section_view` / `outbound_click`
 * events): coarse, URL-free params, always stamped with `app_name: 'docs'`.
 */
export type EventParams = Record<string, string | number | boolean>;

type GtagFn = (command: 'event', name: string, params?: Record<string, unknown>) => void;

export function trackEvent(name: string, params: EventParams = {}): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== 'function') return; // opted out / DNT / GA not configured
  gtag('event', name, { app_name: 'docs', ...params });
}

/** Mirror of `@a14y/telemetry` `bucketScore` so web events match the CLI/extension
 *  buckets without bundling the Node-only telemetry package. */
export type ScoreBucket = '0-25' | '26-50' | '51-75' | '76-100';
export function scoreBucket(n: number): ScoreBucket {
  if (!Number.isFinite(n) || n <= 25) return '0-25';
  if (n <= 50) return '26-50';
  if (n <= 75) return '51-75';
  return '76-100';
}

/** Mirror of `@a14y/telemetry` `bucketIssueCount`. */
export type IssueBucket = '0' | '1-2' | '3-5' | '6-10' | '11+';
export function issueBucket(n: number): IssueBucket {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n <= 2) return '1-2';
  if (n <= 5) return '3-5';
  if (n <= 10) return '6-10';
  return '11+';
}

/** Coarse, URL-free classification of a scan failure. The raw error message can
 *  contain the scanned URL, so it is never sent: only this class is. */
export function classifyScanError(err: unknown): 'proxy' | 'network' | 'other' {
  const message = err instanceof Error ? err.message : String(err);
  if (/proxy error/i.test(message)) return 'proxy';
  if (/failed to fetch|networkerror|load failed|fetch failed|network/i.test(message)) {
    return 'network';
  }
  return 'other';
}

/**
 * One delegated, capture-phase click listener that turns any
 * `[data-install-intent]` element into a `tool_install_intent` event. Delegation
 * means it covers links/buttons rendered at runtime (the scan-results CTA) and
 * every page it's mounted on. Wired once from BaseLayout.
 */
export function initInstallIntentTracking(root: Document = document): void {
  root.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element | null;
      const el = target?.closest<HTMLElement>('[data-install-intent]');
      if (!el) return;
      trackEvent('tool_install_intent', {
        tool: el.dataset.installIntent || 'unknown',
        source: el.dataset.installSource || 'other',
      });
    },
    { capture: true },
  );
}
