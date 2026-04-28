import type { InitOptions, TelemetryEvent } from './types';
import { sanitizeProps, isValidEventName } from './sanitize';
import { BoundedQueue } from './queue';
import { setSession, getSession, resetSession, newSessionId } from './session';

const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_MAX_QUEUE = 100;
const SEND_BATCH_SIZE = 25;

let queue = new BoundedQueue<TelemetryEvent>(DEFAULT_MAX_QUEUE);
let flushTimer: ReturnType<typeof setInterval> | null = null;

export async function init(opts: InitOptions): Promise<void> {
  const enabled =
    opts.initiallyEnabled !== undefined
      ? opts.initiallyEnabled
      : await opts.configProvider.isEnabled();

  let deviceId: string;
  try {
    deviceId = await opts.deviceIdProvider();
  } catch {
    deviceId = newSessionId();
  }

  setSession({
    appName: opts.appName,
    appVersion: opts.appVersion,
    deviceId,
    sessionId: newSessionId(),
    enabled,
    adapter: opts.adapter,
    configProvider: opts.configProvider,
  });

  queue = new BoundedQueue<TelemetryEvent>(opts.maxQueue ?? DEFAULT_MAX_QUEUE);

  if (flushTimer) clearInterval(flushTimer);
  const ms = opts.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  flushTimer = setInterval(() => {
    void flush();
  }, ms);
  const t = flushTimer as unknown as { unref?: () => void };
  if (typeof t.unref === 'function') t.unref();
}

export function track(name: string, props: Record<string, unknown> = {}): void {
  const s = getSession();
  if (!s || !s.enabled) return;
  if (!isValidEventName(name)) return;
  const params = sanitizeProps(props);
  queue.push({ name, params, ts: Date.now() });
}

export async function flush(): Promise<void> {
  const s = getSession();
  if (!s) return;
  const batch = queue.drain(SEND_BATCH_SIZE);
  if (batch.length === 0) return;

  const enveloped = batch.map((e) => ({
    name: e.name,
    ts: e.ts,
    params: {
      ...e.params,
      app_name: s.appName,
      app_version: s.appVersion,
      session_id: s.sessionId,
      engagement_time_msec: 1,
    },
  }));

  try {
    await s.adapter.send({ clientId: s.deviceId, events: enveloped });
  } catch {
    // Telemetry never throws into the host app.
  }
}

export async function setEnabled(enabled: boolean): Promise<void> {
  const s = getSession();
  if (!s) return;
  s.enabled = enabled;
  await s.configProvider.setEnabled(enabled);
}

export function isEnabled(): boolean {
  return getSession()?.enabled ?? false;
}

export function shutdown(): void {
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = null;
  resetSession();
}
