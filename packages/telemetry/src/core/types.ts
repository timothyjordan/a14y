import type { Adapter } from '../adapters/types';

export type AppName = 'cli' | 'extension' | 'docs';

export type EventName =
  | 'cli_command_invoked'
  | 'cli_run_completed'
  | 'cli_error'
  | 'cli_telemetry_disabled'
  | 'ext_installed'
  | 'ext_audit_started'
  | 'ext_audit_completed'
  | 'ext_audit_error'
  | 'ext_settings_changed'
  | 'docs_section_view'
  | 'outbound_click';

export type EventParamValue = string | number | boolean;

export interface TelemetryEvent {
  name: string;
  params: Record<string, EventParamValue>;
  ts: number;
}

export interface ConfigProvider {
  isEnabled(): Promise<boolean>;
  setEnabled(enabled: boolean): Promise<void>;
}

export type DeviceIdProvider = () => Promise<string>;

export interface InitOptions {
  appName: AppName;
  appVersion: string;
  adapter: Adapter;
  deviceIdProvider: DeviceIdProvider;
  configProvider: ConfigProvider;
  flushIntervalMs?: number;
  maxQueue?: number;
  /** Override the resolved enabled state. When omitted, falls back to configProvider.isEnabled(). */
  initiallyEnabled?: boolean;
}
