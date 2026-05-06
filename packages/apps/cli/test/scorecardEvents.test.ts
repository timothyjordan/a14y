import { describe, expect, it, afterEach } from 'vitest';
import type { SiteRun } from '@a14y/core';
import {
  init,
  flush,
  shutdown,
  type Adapter,
  type AdapterPayload,
  type ConfigProvider,
  type DeviceIdProvider,
} from '@a14y/telemetry';
import { emitScorecardChecks } from '../src/scorecardEvents';

function fakeRuntime() {
  const captured: AdapterPayload[] = [];
  const adapter: Adapter = {
    name: 'capture',
    async send(payload) {
      captured.push(payload);
    },
  };
  const configProvider: ConfigProvider = {
    async isEnabled() {
      return true;
    },
    async setEnabled() {},
  };
  const deviceIdProvider: DeviceIdProvider = async () => 'device-test';
  return { adapter, configProvider, deviceIdProvider, captured };
}

function makeRun(): SiteRun {
  return {
    url: 'https://example.com',
    baseUrl: 'https://example.com/',
    mode: 'site',
    scorecardVersion: '0.2.0',
    scorecardReleasedAt: '2026-01-01',
    startedAt: '2026-05-06T00:00:00Z',
    finishedAt: '2026-05-06T00:00:01Z',
    siteChecks: [
      { id: 'site.llms-txt', name: 'llms.txt', scope: 'site', implementationVersion: '1.0.0', status: 'pass', docsUrl: 'd' },
      { id: 'site.agents-md', name: 'AGENTS.md', scope: 'site', implementationVersion: '1.0.0', status: 'fail', docsUrl: 'd' },
    ],
    pages: [
      {
        url: 'https://example.com/',
        finalUrl: 'https://example.com/',
        status: 200,
        sources: [],
        checks: [
          { id: 'html.canonical-link', name: 'canonical', scope: 'page', implementationVersion: '1.0.0', status: 'pass', docsUrl: 'd' },
          { id: 'html.title', name: 'title', scope: 'page', implementationVersion: '1.0.0', status: 'fail', docsUrl: 'd' },
        ],
        summary: { passed: 1, failed: 1, warned: 0, errored: 0, na: 0, total: 2, applicable: 2, score: 50 },
      },
      {
        url: 'https://example.com/a',
        finalUrl: 'https://example.com/a',
        status: 200,
        sources: [],
        checks: [
          { id: 'html.canonical-link', name: 'canonical', scope: 'page', implementationVersion: '1.0.0', status: 'pass', docsUrl: 'd' },
          { id: 'html.title', name: 'title', scope: 'page', implementationVersion: '1.0.0', status: 'pass', docsUrl: 'd' },
        ],
        summary: { passed: 2, failed: 0, warned: 0, errored: 0, na: 0, total: 2, applicable: 2, score: 100 },
      },
      {
        url: 'https://example.com/b',
        finalUrl: 'https://example.com/b',
        status: 200,
        sources: [],
        checks: [
          { id: 'html.canonical-link', name: 'canonical', scope: 'page', implementationVersion: '1.0.0', status: 'warn', docsUrl: 'd' },
          { id: 'html.title', name: 'title', scope: 'page', implementationVersion: '1.0.0', status: 'pass', docsUrl: 'd' },
        ],
        summary: { passed: 1, failed: 0, warned: 1, errored: 0, na: 0, total: 2, applicable: 2, score: 50 },
      },
    ],
    summary: { passed: 5, failed: 2, warned: 1, errored: 0, na: 0, total: 8, applicable: 8, score: 63 },
  };
}

describe('emitScorecardChecks', () => {
  afterEach(() => shutdown());

  it('emits one event per site check + one rolled-up event per page check id', async () => {
    const rt = fakeRuntime();
    await init({
      appName: 'cli',
      appVersion: '0.0.0',
      adapter: rt.adapter,
      deviceIdProvider: rt.deviceIdProvider,
      configProvider: rt.configProvider,
      flushIntervalMs: 60_000,
    });

    const count = emitScorecardChecks({ run: makeRun(), runId: 'run-1234', surface: 'cli' });
    await flush();

    expect(count).toBe(4); // 2 site + 2 page-check ids
    const events = rt.captured.flatMap((p) => p.events);
    expect(events).toHaveLength(4);
    for (const evt of events) {
      expect(evt.name).toBe('scorecard_check_result');
      expect(evt.params.run_id).toBe('run-1234');
      expect(evt.params.scorecard_version).toBe('0.2.0');
      expect(evt.params.surface).toBe('cli');
    }
  });

  it('site checks pass through verbatim status, page checks roll up', async () => {
    const rt = fakeRuntime();
    await init({
      appName: 'cli',
      appVersion: '0.0.0',
      adapter: rt.adapter,
      deviceIdProvider: rt.deviceIdProvider,
      configProvider: rt.configProvider,
      flushIntervalMs: 60_000,
    });

    emitScorecardChecks({ run: makeRun(), runId: 'run-x', surface: 'cli' });
    await flush();

    const events = rt.captured.flatMap((p) => p.events);
    const byCheck = Object.fromEntries(events.map((e) => [e.params.check_id, e.params]));

    expect(byCheck['site.llms-txt'].status).toBe('pass');
    expect(byCheck['site.llms-txt']).not.toHaveProperty('failed_pages');
    expect(byCheck['site.agents-md'].status).toBe('fail');

    expect(byCheck['html.canonical-link'].status).toBe('warn');
    expect(byCheck['html.canonical-link'].failed_pages).toBe(0);
    expect(byCheck['html.canonical-link'].total_pages).toBe(3);

    expect(byCheck['html.title'].status).toBe('fail');
    expect(byCheck['html.title'].failed_pages).toBe(1);
    expect(byCheck['html.title'].total_pages).toBe(3);
  });
});
