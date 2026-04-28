import { randomUUID } from 'crypto';
import {
  init,
  track,
  flush,
  isEnabled,
  setEnabled,
  shutdown,
  noopAdapter,
  createGa4MpAdapter,
  createNodeRuntime,
  type Adapter,
  type NodeRuntime,
} from '@a14y/telemetry';
import {
  GA4_MEASUREMENT_ID,
  GA4_MP_API_SECRET,
} from './generated/telemetry-config';

// Kept in sync with package.json. Used as `app_version` on every event.
const APP_VERSION = '0.3.0';

const FIRST_RUN_NOTICE = [
  '',
  'a14y collects anonymous usage data to help improve the CLI.',
  'No URLs or audited content are recorded. See https://a14y.dev/privacy for the full list.',
  'Disable any time with:',
  '  --no-telemetry         (per command)',
  '  A14Y_TELEMETRY=0       (env)',
  '  edit ~/.a14y/config.json   ("telemetryEnabled": false)',
  '',
].join('\n');

export type DisableSource = 'flag' | 'env' | 'do_not_track' | 'ci' | 'config';

export interface InitCliOptions {
  flagDisabled: boolean;
}

export interface InitCliResult {
  runtime: NodeRuntime;
  resolvedDisable: DisableSource | null;
}

export async function initCliTelemetry(opts: InitCliOptions): Promise<InitCliResult> {
  const runtime = createNodeRuntime();

  let resolvedDisable: DisableSource | null = null;
  if (opts.flagDisabled) resolvedDisable = 'flag';
  else if (process.env.A14Y_TELEMETRY === '0' || process.env.A14Y_TELEMETRY === 'false')
    resolvedDisable = 'env';
  else if (process.env.DO_NOT_TRACK === '1') resolvedDisable = 'do_not_track';
  else if (process.env.CI === 'true' || process.env.CI === '1') resolvedDisable = 'ci';

  const configEnabled = await runtime.configProvider.isEnabled();
  if (resolvedDisable === null && !configEnabled) resolvedDisable = 'config';

  const adapter = pickAdapter();
  const initiallyEnabled = resolvedDisable === null;

  await init({
    appName: 'cli',
    appVersion: APP_VERSION,
    adapter,
    deviceIdProvider: runtime.deviceIdProvider,
    configProvider: runtime.configProvider,
    initiallyEnabled,
  });

  // Fire a one-shot ack when the user is actively overriding a config that
  // had telemetry enabled. Skip when their config was already opted out
  // (we'd just be pinging GA on every run for no reason) and skip when the
  // adapter is noop (no provider configured).
  if (
    resolvedDisable !== null &&
    resolvedDisable !== 'config' &&
    configEnabled &&
    adapter !== noopAdapter
  ) {
    await sendDisableAck(adapter, runtime, resolvedDisable);
  }

  return { runtime, resolvedDisable };
}

export async function maybeShowFirstRunNotice(
  runtime: NodeRuntime,
  outputFormat: string,
): Promise<void> {
  if (!isEnabled()) return;
  if (outputFormat === 'json') return;
  if (!process.stderr.isTTY) return;
  if (await runtime.isFirstRunNoticeShown()) return;
  process.stderr.write(FIRST_RUN_NOTICE);
  await runtime.markFirstRunNoticeShown();
}

export async function flushAndShutdown(): Promise<void> {
  try {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    await Promise.race([
      flush(),
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, 1500);
        const t = timeoutId as unknown as { unref?: () => void };
        if (typeof t.unref === 'function') t.unref();
      }),
    ]);
    if (timeoutId) clearTimeout(timeoutId);
  } finally {
    shutdown();
  }
}

function pickAdapter(): Adapter {
  if (!GA4_MEASUREMENT_ID || !GA4_MP_API_SECRET) return noopAdapter;
  return createGa4MpAdapter({
    measurementId: GA4_MEASUREMENT_ID,
    apiSecret: GA4_MP_API_SECRET,
    debug: process.env.A14Y_TELEMETRY_DEBUG === '1',
  });
}

async function sendDisableAck(
  adapter: Adapter,
  runtime: NodeRuntime,
  source: DisableSource,
): Promise<void> {
  try {
    const deviceId = await runtime.deviceIdProvider();
    await adapter.send({
      clientId: deviceId,
      events: [
        {
          name: 'cli_telemetry_disabled',
          ts: Date.now(),
          params: {
            source,
            app_name: 'cli',
            app_version: APP_VERSION,
            session_id: randomUUID(),
            engagement_time_msec: 1,
          },
        },
      ],
    });
  } catch {
    // never throw out of telemetry
  }
}

export { track, isEnabled, setEnabled };
