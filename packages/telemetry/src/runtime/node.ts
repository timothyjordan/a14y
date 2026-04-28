import { promises as fs } from 'fs';
import { homedir } from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type { ConfigProvider, DeviceIdProvider } from '../core/types';

interface ConfigFile {
  deviceId?: string;
  telemetryEnabled?: boolean;
  firstRunNoticeShown?: boolean;
}

function configDir(): string | null {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg && xdg.length > 0) return path.join(xdg, 'a14y');
  let home: string;
  try {
    home = homedir();
  } catch {
    return null;
  }
  if (!home) return null;
  return path.join(home, '.a14y');
}

async function readConfigFile(dir: string): Promise<ConfigFile> {
  const file = path.join(dir, 'config.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as ConfigFile;
    return {};
  } catch {
    return {};
  }
}

async function writeConfigFile(dir: string, cfg: ConfigFile): Promise<void> {
  const file = path.join(dir, 'config.json');
  const tmp = file + '.tmp';
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(cfg, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export interface NodeRuntime {
  deviceIdProvider: DeviceIdProvider;
  configProvider: ConfigProvider;
  isFirstRunNoticeShown(): Promise<boolean>;
  markFirstRunNoticeShown(): Promise<void>;
  /** True when the on-disk config is unavailable and we're using ephemeral memory. */
  isEphemeral(): boolean;
}

export function createNodeRuntime(): NodeRuntime {
  const dir = configDir();
  let ephemeral: ConfigFile | null = null;
  let forcedEphemeral = dir === null;

  async function read(): Promise<ConfigFile> {
    if (forcedEphemeral || dir === null) {
      if (!ephemeral) ephemeral = { deviceId: randomUUID(), telemetryEnabled: false };
      return ephemeral;
    }
    return readConfigFile(dir);
  }

  async function update(updater: (cfg: ConfigFile) => ConfigFile): Promise<void> {
    if (forcedEphemeral || dir === null) {
      ephemeral = updater(ephemeral ?? {});
      return;
    }
    const cur = await readConfigFile(dir);
    const next = updater(cur);
    try {
      await writeConfigFile(dir, next);
    } catch {
      forcedEphemeral = true;
      ephemeral = { ...next, telemetryEnabled: false };
    }
  }

  return {
    async deviceIdProvider(): Promise<string> {
      const cfg = await read();
      if (typeof cfg.deviceId === 'string' && cfg.deviceId.length > 0) return cfg.deviceId;
      const id = randomUUID();
      await update((c) => ({ ...c, deviceId: id }));
      return id;
    },
    configProvider: {
      async isEnabled(): Promise<boolean> {
        if (forcedEphemeral) return false;
        const cfg = await read();
        return cfg.telemetryEnabled !== false;
      },
      async setEnabled(enabled: boolean): Promise<void> {
        await update((c) => ({ ...c, telemetryEnabled: enabled }));
      },
    },
    async isFirstRunNoticeShown(): Promise<boolean> {
      const cfg = await read();
      return cfg.firstRunNoticeShown === true;
    },
    async markFirstRunNoticeShown(): Promise<void> {
      await update((c) => ({ ...c, firstRunNoticeShown: true }));
    },
    isEphemeral(): boolean {
      return forcedEphemeral;
    },
  };
}
