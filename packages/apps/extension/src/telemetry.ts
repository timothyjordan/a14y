/// <reference types="chrome" />

import {
  init,
  track,
  flush,
  setEnabled,
  noopAdapter,
  createGa4MpAdapter,
  type Adapter,
} from '@a14y/telemetry';
import {
  createChromeExtRuntime,
  type ChromeExtRuntime,
} from '@a14y/telemetry/chrome-ext';
import {
  GA4_MEASUREMENT_ID,
  GA4_MP_API_SECRET,
} from './generated/telemetry-config';

const APP_VERSION = chrome.runtime.getManifest().version;

let runtimeRef: ChromeExtRuntime | null = null;

export async function initExtensionTelemetry(): Promise<ChromeExtRuntime> {
  const runtime = createChromeExtRuntime();
  runtimeRef = runtime;
  const adapter = pickAdapter();
  await init({
    appName: 'extension',
    appVersion: APP_VERSION,
    adapter,
    deviceIdProvider: runtime.deviceIdProvider,
    configProvider: runtime.configProvider,
    flushIntervalMs: 5_000,
  });
  // React to options-page toggles without a full re-init.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const settingsChange = changes['a14y:settings'];
    if (!settingsChange) return;
    const next = settingsChange.newValue as { telemetryEnabled?: boolean } | undefined;
    void setEnabled(next?.telemetryEnabled !== false);
  });
  return runtime;
}

export function getExtensionRuntime(): ChromeExtRuntime | null {
  return runtimeRef;
}

function pickAdapter(): Adapter {
  if (!GA4_MEASUREMENT_ID || !GA4_MP_API_SECRET) return noopAdapter;
  return createGa4MpAdapter({
    measurementId: GA4_MEASUREMENT_ID,
    apiSecret: GA4_MP_API_SECRET,
  });
}

export { track, flush };
