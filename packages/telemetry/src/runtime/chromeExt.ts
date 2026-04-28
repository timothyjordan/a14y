import type { ConfigProvider, DeviceIdProvider } from '../core/types';

const STORAGE_KEY_DEVICE_ID = 'a14y:device-id';
const STORAGE_KEY_SETTINGS = 'a14y:settings';

interface ChromeStorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

interface ChromeExtSettings {
  telemetryEnabled?: boolean;
  telemetryNoticeShown?: boolean;
  [key: string]: unknown;
}

function getStorage(): ChromeStorageArea {
  const c = (
    globalThis as unknown as {
      chrome?: { storage?: { local?: ChromeStorageArea } };
    }
  ).chrome;
  if (!c?.storage?.local) {
    throw new Error('chrome.storage.local not available');
  }
  return c.storage.local;
}

function uuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => void } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (g.crypto?.getRandomValues) g.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20)
  );
}

async function readSettings(storage: ChromeStorageArea): Promise<ChromeExtSettings> {
  const got = await storage.get(STORAGE_KEY_SETTINGS);
  const v = got[STORAGE_KEY_SETTINGS];
  return v && typeof v === 'object' ? (v as ChromeExtSettings) : {};
}

async function writeSettings(
  storage: ChromeStorageArea,
  patch: Partial<ChromeExtSettings>,
): Promise<void> {
  const cur = await readSettings(storage);
  await storage.set({ [STORAGE_KEY_SETTINGS]: { ...cur, ...patch } });
}

export interface ChromeExtRuntime {
  deviceIdProvider: DeviceIdProvider;
  configProvider: ConfigProvider;
  isNoticeShown(): Promise<boolean>;
  markNoticeShown(): Promise<void>;
}

export function createChromeExtRuntime(): ChromeExtRuntime {
  return {
    async deviceIdProvider(): Promise<string> {
      const storage = getStorage();
      const got = await storage.get(STORAGE_KEY_DEVICE_ID);
      const existing = got[STORAGE_KEY_DEVICE_ID];
      if (typeof existing === 'string' && existing.length > 0) return existing;
      const id = uuid();
      await storage.set({ [STORAGE_KEY_DEVICE_ID]: id });
      return id;
    },
    configProvider: {
      async isEnabled(): Promise<boolean> {
        const storage = getStorage();
        const settings = await readSettings(storage);
        return settings.telemetryEnabled !== false;
      },
      async setEnabled(enabled: boolean): Promise<void> {
        await writeSettings(getStorage(), { telemetryEnabled: enabled });
      },
    },
    async isNoticeShown(): Promise<boolean> {
      const settings = await readSettings(getStorage());
      return settings.telemetryNoticeShown === true;
    },
    async markNoticeShown(): Promise<void> {
      await writeSettings(getStorage(), { telemetryNoticeShown: true });
    },
  };
}
