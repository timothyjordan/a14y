// Public API for @a14y/telemetry. The CLI and Chrome extension import everything from this entry.
// `sideEffects: false` in package.json lets bundlers (Vite/Rollup) drop the
// runtime helper that the consuming app doesn't reference — the extension
// strips the Node runtime, Node consumers strip the chrome-ext runtime.

export { init, track, setEnabled, isEnabled, flush, shutdown } from './core/tracker';
export { createNodeRuntime, type NodeRuntime } from './runtime/node';
export {
  createChromeExtRuntime,
  type ChromeExtRuntime,
} from './runtime/chromeExt';
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
