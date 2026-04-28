import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createChromeExtRuntime } from '../src/runtime/chromeExt';

interface FakeStore {
  data: Record<string, unknown>;
}

function installFakeChrome(): FakeStore {
  const store: FakeStore = { data: {} };
  const local = {
    async get(keys: string | string[] | null) {
      if (keys === null) return { ...store.data };
      const arr = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of arr) {
        if (k in store.data) out[k] = store.data[k];
      }
      return out;
    },
    async set(items: Record<string, unknown>) {
      Object.assign(store.data, items);
    },
  };
  (globalThis as { chrome?: unknown }).chrome = { storage: { local } };
  return store;
}

function clearFakeChrome() {
  delete (globalThis as { chrome?: unknown }).chrome;
}

describe('createChromeExtRuntime', () => {
  let store: FakeStore;

  beforeEach(() => {
    store = installFakeChrome();
  });

  afterEach(() => {
    clearFakeChrome();
  });

  it('generates and persists a device id', async () => {
    const rt = createChromeExtRuntime();
    const id1 = await rt.deviceIdProvider();
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
    const id2 = await rt.deviceIdProvider();
    expect(id2).toBe(id1);
  });

  it('reuses an existing device id from storage', async () => {
    store.data['a14y:device-id'] = 'preset-id';
    const rt = createChromeExtRuntime();
    expect(await rt.deviceIdProvider()).toBe('preset-id');
  });

  it('default isEnabled is true and toggles persist', async () => {
    const rt = createChromeExtRuntime();
    expect(await rt.configProvider.isEnabled()).toBe(true);
    await rt.configProvider.setEnabled(false);
    expect(await rt.configProvider.isEnabled()).toBe(false);
    expect((store.data['a14y:settings'] as { telemetryEnabled?: boolean }).telemetryEnabled).toBe(false);
  });

  it('preserves other settings keys when toggling', async () => {
    store.data['a14y:settings'] = { maxPages: 100, telemetryEnabled: true };
    const rt = createChromeExtRuntime();
    await rt.configProvider.setEnabled(false);
    expect(store.data['a14y:settings']).toEqual({ maxPages: 100, telemetryEnabled: false });
  });

  it('tracks notice-shown state', async () => {
    const rt = createChromeExtRuntime();
    expect(await rt.isNoticeShown()).toBe(false);
    await rt.markNoticeShown();
    expect(await rt.isNoticeShown()).toBe(true);
  });

  it('throws if chrome.storage.local is unavailable', async () => {
    clearFakeChrome();
    const rt = createChromeExtRuntime();
    await expect(rt.deviceIdProvider()).rejects.toThrow('chrome.storage.local');
  });
});
