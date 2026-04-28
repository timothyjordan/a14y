// Public API for @a14y/telemetry — runtime-agnostic surface only.
// Runtime helpers live behind subpath exports:
//   import { createNodeRuntime } from '@a14y/telemetry/node';
//   import { createChromeExtRuntime } from '@a14y/telemetry/chrome-ext';
// Splitting them out keeps the extension bundle from pulling in `fs`/`os`
// and the Node consumers from pulling in the chrome.* type surface.

export { init, track, setEnabled, isEnabled, flush, shutdown } from './core/tracker';
export {
  bucketScore,
  bucketPageCount,
  bucketIssueCount,
  bucketDurationMs,
  type ScoreBucket,
  type PageCountBucket,
  type IssueCountBucket,
  type DurationBucket,
} from './core/buckets';
export { sanitizeProps, errorClassName, isValidEventName } from './core/sanitize';
export type {
  AppName,
  EventName,
  EventParamValue,
  TelemetryEvent,
  ConfigProvider,
  DeviceIdProvider,
  InitOptions,
} from './core/types';
export { noopAdapter } from './adapters/noop';
export { createGa4MpAdapter, type Ga4MpAdapterOptions } from './adapters/ga4-mp';
export type { Adapter, AdapterPayload } from './adapters/types';
