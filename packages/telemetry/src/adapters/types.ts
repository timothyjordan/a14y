import type { TelemetryEvent } from '../core/types';

export interface AdapterPayload {
  clientId: string;
  events: TelemetryEvent[];
}

export interface Adapter {
  readonly name: string;
  send(payload: AdapterPayload): Promise<void>;
}
