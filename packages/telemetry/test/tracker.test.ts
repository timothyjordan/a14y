import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  init,
  track,
  flush,
  setEnabled,
  isEnabled,
  shutdown,
} from '../src/core/tracker';
import type { Adapter, AdapterPayload } from '../src/adapters/types';
import type { ConfigProvider, DeviceIdProvider } from '../src/core/types';

function fakeRuntime(initial?: { enabled?: boolean; deviceId?: string }) {
  let enabled = initial?.enabled ?? true;
  const deviceId = initial?.deviceId ?? 'device-test-1';
  const captured: AdapterPayload[] = [];
  const adapter: Adapter = {
    name: 'capture',
    async send(payload) {
      captured.push(payload);
    },
  };
  const configProvider: ConfigProvider = {
    async isEnabled() {
      return enabled;
    },
    async setEnabled(v: boolean) {
      enabled = v;
    },
  };
  const deviceIdProvider: DeviceIdProvider = async () => deviceId;
  return { adapter, configProvider, deviceIdProvider, captured };
}

describe('tracker', () => {
  afterEach(() => {
    shutdown();
  });

  it('captures events when enabled and flushes them', async () => {
    const r = fakeRuntime();
    await init({
      appName: 'cli',
      appVersion: '0.1.0',
      adapter: r.adapter,
      configProvider: r.configProvider,
      deviceIdProvider: r.deviceIdProvider,
      flushIntervalMs: 1_000_000,
    });
    track('cli_command_invoked', { command: 'check', verbose: false });
    track('cli_run_completed', { score_bucket: '76-100' });
    await flush();
    expect(r.captured).toHaveLength(1);
    const sent = r.captured[0];
    expect(sent.clientId).toBe('device-test-1');
    expect(sent.events).toHaveLength(2);
    expect(sent.events[0].name).toBe('cli_command_invoked');
    expect(sent.events[0].params).toMatchObject({
      command: 'check',
      verbose: false,
      app_name: 'cli',
      app_version: '0.1.0',
      engagement_time_msec: 1,
    });
    expect(sent.events[0].params.session_id).toEqual(expect.any(String));
  });

  it('does not capture when disabled', async () => {
    const r = fakeRuntime({ enabled: false });
    await init({
      appName: 'cli',
      appVersion: '0.1.0',
      adapter: r.adapter,
      configProvider: r.configProvider,
      deviceIdProvider: r.deviceIdProvider,
      flushIntervalMs: 1_000_000,
    });
    track('cli_command_invoked', { command: 'check' });
    await flush();
    expect(r.captured).toEqual([]);
    expect(isEnabled()).toBe(false);
  });

  it('respects initiallyEnabled override', async () => {
    const r = fakeRuntime({ enabled: true });
    await init({
      appName: 'cli',
      appVersion: '0.1.0',
      adapter: r.adapter,
      configProvider: r.configProvider,
      deviceIdProvider: r.deviceIdProvider,
      flushIntervalMs: 1_000_000,
      initiallyEnabled: false,
    });
    track('cli_command_invoked');
    await flush();
    expect(r.captured).toEqual([]);
  });

  it('drops invalid event names', async () => {
    const r = fakeRuntime();
    await init({
      appName: 'cli',
      appVersion: '0.1.0',
      adapter: r.adapter,
      configProvider: r.configProvider,
      deviceIdProvider: r.deviceIdProvider,
      flushIntervalMs: 1_000_000,
    });
    track('1invalid');
    track('has space');
    track('valid_name');
    await flush();
    expect(r.captured[0].events.map((e) => e.name)).toEqual(['valid_name']);
  });

  it('strips PII params before queueing', async () => {
    const r = fakeRuntime();
    await init({
      appName: 'cli',
      appVersion: '0.1.0',
      adapter: r.adapter,
      configProvider: r.configProvider,
      deviceIdProvider: r.deviceIdProvider,
      flushIntervalMs: 1_000_000,
    });
    track('cli_command_invoked', { url: 'https://x.com', command: 'check' });
    await flush();
    const params = r.captured[0].events[0].params;
    expect(params.url).toBeUndefined();
    expect(params.command).toBe('check');
  });

  it('does not throw when adapter rejects', async () => {
    let enabled = true;
    const adapter: Adapter = {
      name: 'broken',
      async send() {
        throw new Error('network');
      },
    };
    await init({
      appName: 'cli',
      appVersion: '0.1.0',
      adapter,
      configProvider: { async isEnabled() { return enabled; }, async setEnabled(v) { enabled = v; } },
      deviceIdProvider: async () => 'd',
      flushIntervalMs: 1_000_000,
    });
    track('cli_command_invoked');
    await expect(flush()).resolves.toBeUndefined();
  });

  it('setEnabled flips state and persists', async () => {
    const r = fakeRuntime({ enabled: true });
    await init({
      appName: 'cli',
      appVersion: '0.1.0',
      adapter: r.adapter,
      configProvider: r.configProvider,
      deviceIdProvider: r.deviceIdProvider,
      flushIntervalMs: 1_000_000,
    });
    expect(isEnabled()).toBe(true);
    await setEnabled(false);
    expect(isEnabled()).toBe(false);
    track('cli_command_invoked');
    await flush();
    expect(r.captured).toEqual([]);
  });

  it('does nothing when track() is called before init()', async () => {
    track('cli_command_invoked');
    // No throw, no session set up.
    expect(isEnabled()).toBe(false);
  });
});
