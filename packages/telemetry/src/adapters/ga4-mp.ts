import type { Adapter, AdapterPayload } from './types';

export interface Ga4MpAdapterOptions {
  measurementId: string;
  apiSecret: string;
  /** When true, target the GA4 DebugView endpoint (validates payload, surfaces in DebugView). */
  debug?: boolean;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

export function createGa4MpAdapter(opts: Ga4MpAdapterOptions): Adapter {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const host = opts.endpoint ?? 'https://www.google-analytics.com';
  const path = opts.debug ? '/debug/mp/collect' : '/mp/collect';

  return {
    name: opts.debug ? 'ga4-mp-debug' : 'ga4-mp',
    async send(payload: AdapterPayload): Promise<void> {
      if (payload.events.length === 0) return;
      if (typeof fetchImpl !== 'function') return;
      const url =
        host +
        path +
        '?measurement_id=' +
        encodeURIComponent(opts.measurementId) +
        '&api_secret=' +
        encodeURIComponent(opts.apiSecret);
      const body = JSON.stringify({
        client_id: payload.clientId,
        events: payload.events.map((e) => ({ name: e.name, params: e.params })),
      });
      try {
        await fetchImpl(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
      } catch {
        // Network failures are swallowed.
      }
    },
  };
}
