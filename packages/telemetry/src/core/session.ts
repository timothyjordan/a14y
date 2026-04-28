import type { Adapter } from '../adapters/types';
import type { AppName, ConfigProvider } from './types';

export interface Session {
  appName: AppName;
  appVersion: string;
  deviceId: string;
  sessionId: string;
  enabled: boolean;
  adapter: Adapter;
  configProvider: ConfigProvider;
}

let session: Session | null = null;

export function setSession(s: Session): void {
  session = s;
}

export function getSession(): Session | null {
  return session;
}

export function resetSession(): void {
  session = null;
}

/** 16-hex-char session id. Not a security boundary — uniqueness within a run is enough. */
export function newSessionId(): string {
  const bytes = new Uint8Array(8);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
