import { describe, it, expect, afterEach } from 'vitest';
import { init, flush, shutdown } from '../src/core/tracker';
import { generateRunId, rollupPageStatuses, trackScorecardCheckResult } from '../src/scorecard';
import type { Adapter, AdapterPayload } from '../src/adapters/types';
import type { ConfigProvider, DeviceIdProvider } from '../src/core/types';

function fakeRuntime(initial?: { enabled?: boolean }) {
  let enabled = initial?.enabled ?? true;
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
    async setEnabled(v) {
      enabled = v;
    },
  };
  const deviceIdProvider: DeviceIdProvider = async () => 'device-test';
  return { adapter, configProvider, deviceIdProvider, captured };
}

describe('generateRunId', () => {
  afterEach(() => shutdown());

  it('returns 8 hex characters', () => {
    const id = generateRunId();
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('produces different ids on successive calls', () => {
    const a = generateRunId();
    const b = generateRunId();
    expect(a).not.toBe(b);
  });
});

describe('rollupPageStatuses', () => {
  it('returns na when given no statuses', () => {
    expect(rollupPageStatuses([])).toEqual({ status: 'na', failedPages: 0, totalPages: 0 });
  });

  it('returns pass when every page passes', () => {
    expect(rollupPageStatuses(['pass', 'pass', 'pass'])).toEqual({
      status: 'pass',
      failedPages: 0,
      totalPages: 3,
    });
  });

  it('fail beats every other status', () => {
    expect(
      rollupPageStatuses(['pass', 'fail', 'warn', 'error', 'na']),
    ).toEqual({ status: 'fail', failedPages: 1, totalPages: 5 });
  });

  it('error wins when no fails are present', () => {
    expect(rollupPageStatuses(['pass', 'warn', 'error', 'na'])).toEqual({
      status: 'error',
      failedPages: 0,
      totalPages: 4,
    });
  });

  it('warn wins when only warns + passes + nas are present', () => {
    expect(rollupPageStatuses(['pass', 'warn', 'na'])).toEqual({
      status: 'warn',
      failedPages: 0,
      totalPages: 3,
    });
  });

  it('returns na when every page is na', () => {
    expect(rollupPageStatuses(['na', 'na'])).toEqual({
      status: 'na',
      failedPages: 0,
      totalPages: 2,
    });
  });

  it('counts failed pages across mixed statuses', () => {
    expect(
      rollupPageStatuses(['fail', 'pass', 'fail', 'fail', 'warn']),
    ).toEqual({ status: 'fail', failedPages: 3, totalPages: 5 });
  });
});

describe('trackScorecardCheckResult', () => {
  afterEach(() => shutdown());

  it('emits one event with the expected GA4 param shape', async () => {
    const rt = fakeRuntime();
    await init({
      appName: 'cli',
      appVersion: '1.2.3',
      adapter: rt.adapter,
      deviceIdProvider: rt.deviceIdProvider,
      configProvider: rt.configProvider,
      flushIntervalMs: 60_000,
    });

    trackScorecardCheckResult({
      runId: 'abcd1234',
      checkId: 'html.canonical-link',
      status: 'fail',
      scorecardVersion: '0.2.0',
      surface: 'cli',
      failedPages: 2,
      totalPages: 7,
    });
    await flush();

    expect(rt.captured).toHaveLength(1);
    const evt = rt.captured[0].events[0];
    expect(evt.name).toBe('scorecard_check_result');
    expect(evt.params).toMatchObject({
      run_id: 'abcd1234',
      check_id: 'html.canonical-link',
      status: 'fail',
      scorecard_version: '0.2.0',
      surface: 'cli',
      failed_pages: 2,
      total_pages: 7,
    });
  });

  it('omits failed_pages and total_pages when undefined', async () => {
    const rt = fakeRuntime();
    await init({
      appName: 'cli',
      appVersion: '1.2.3',
      adapter: rt.adapter,
      deviceIdProvider: rt.deviceIdProvider,
      configProvider: rt.configProvider,
      flushIntervalMs: 60_000,
    });

    trackScorecardCheckResult({
      runId: 'abcd1234',
      checkId: 'site.llms-txt',
      status: 'pass',
      scorecardVersion: '0.2.0',
      surface: 'ext',
    });
    await flush();

    const params = rt.captured[0].events[0].params;
    expect(params).not.toHaveProperty('failed_pages');
    expect(params).not.toHaveProperty('total_pages');
    expect(params.status).toBe('pass');
    expect(params.surface).toBe('ext');
  });

  it('does not enqueue when telemetry is disabled', async () => {
    const rt = fakeRuntime({ enabled: false });
    await init({
      appName: 'cli',
      appVersion: '1.2.3',
      adapter: rt.adapter,
      deviceIdProvider: rt.deviceIdProvider,
      configProvider: rt.configProvider,
      flushIntervalMs: 60_000,
    });
    trackScorecardCheckResult({
      runId: 'abcd1234',
      checkId: 'html.canonical-link',
      status: 'pass',
      scorecardVersion: '0.2.0',
      surface: 'cli',
    });
    await flush();
    expect(rt.captured).toHaveLength(0);
  });
});
