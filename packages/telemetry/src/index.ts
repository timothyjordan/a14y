// Public API for @a14y/telemetry. The CLI and Chrome extension import from
// here and from the runtime subpath modules ('@a14y/telemetry/node' and
// '@a14y/telemetry/chrome-ext').

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
