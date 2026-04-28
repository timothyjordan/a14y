import { describe, it, expect } from 'vitest';
import { createGa4MpAdapter } from '../src/adapters/ga4-mp';
import type { TelemetryEvent } from '../src/core/types';

interface FakeCall {
  url: string;
  init: RequestInit;
}

function fakeFetch(): { calls: FakeCall[]; impl: typeof fetch } {
  const calls: FakeCall[] = [];
  const impl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return { ok: true, status: 204 } as Response;
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const sampleEvents: TelemetryEvent[] = [
  { name: 'cli_command_invoked', params: { command: 'check' }, ts: 1 },
  { name: 'cli_run_completed', params: { score_bucket: '76-100' }, ts: 2 },
];

describe('createGa4MpAdapter', () => {
  it('POSTs to /mp/collect with measurement_id + api_secret query and JSON body', async () => {
    const f = fakeFetch();
    const adapter = createGa4MpAdapter({
      measurementId: 'G-TEST',
      apiSecret: 'SECRET&1',
      fetchImpl: f.impl,
    });
    await adapter.send({ clientId: 'd-1', events: sampleEvents });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(
      'https://www.google-analytics.com/mp/collect?measurement_id=G-TEST&api_secret=SECRET%261',
    );
    expect(f.calls[0].init.method).toBe('POST');
    const body = JSON.parse(String(f.calls[0].init.body));
    expect(body).toEqual({
      client_id: 'd-1',
      events: [
        { name: 'cli_command_invoked', params: { command: 'check' } },
        { name: 'cli_run_completed', params: { score_bucket: '76-100' } },
      ],
    });
  });

  it('uses the debug endpoint when debug:true', async () => {
    const f = fakeFetch();
    const adapter = createGa4MpAdapter({
      measurementId: 'G-TEST',
      apiSecret: 'S',
      debug: true,
      fetchImpl: f.impl,
    });
    await adapter.send({ clientId: 'd', events: sampleEvents });
    expect(f.calls[0].url).toContain('/debug/mp/collect');
    expect(adapter.name).toBe('ga4-mp-debug');
  });

  it('honors a custom endpoint', async () => {
    const f = fakeFetch();
    const adapter = createGa4MpAdapter({
      measurementId: 'G',
      apiSecret: 'S',
      endpoint: 'https://example.test',
      fetchImpl: f.impl,
    });
    await adapter.send({ clientId: 'd', events: sampleEvents });
    expect(f.calls[0].url.startsWith('https://example.test/mp/collect')).toBe(true);
  });

  it('skips the request when there are no events', async () => {
    const f = fakeFetch();
    const adapter = createGa4MpAdapter({
      measurementId: 'G',
      apiSecret: 'S',
      fetchImpl: f.impl,
    });
    await adapter.send({ clientId: 'd', events: [] });
    expect(f.calls).toHaveLength(0);
  });

  it('swallows network errors silently', async () => {
    const adapter = createGa4MpAdapter({
      measurementId: 'G',
      apiSecret: 'S',
      fetchImpl: (async () => {
        throw new Error('boom');
      }) as unknown as typeof fetch,
    });
    await expect(
      adapter.send({ clientId: 'd', events: sampleEvents }),
    ).resolves.toBeUndefined();
  });

  it('does nothing when fetch is unavailable', async () => {
    const adapter = createGa4MpAdapter({
      measurementId: 'G',
      apiSecret: 'S',
      fetchImpl: undefined as unknown as typeof fetch,
    });
    await expect(
      adapter.send({ clientId: 'd', events: sampleEvents }),
    ).resolves.toBeUndefined();
  });
});
