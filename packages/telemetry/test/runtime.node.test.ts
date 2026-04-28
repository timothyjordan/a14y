import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { createNodeRuntime } from '../src/runtime/node';

let tmpRoot: string;
const ORIGINAL_XDG = process.env.XDG_CONFIG_HOME;

beforeEach(() => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), 'a14y-telemetry-test-'));
  process.env.XDG_CONFIG_HOME = tmpRoot;
});

afterEach(() => {
  if (ORIGINAL_XDG === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = ORIGINAL_XDG;
  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

describe('createNodeRuntime', () => {
  it('generates a stable device id on first call and reuses it', async () => {
    const rt1 = createNodeRuntime();
    const id1 = await rt1.deviceIdProvider();
    expect(id1).toMatch(/^[0-9a-f-]{36}$/);

    const rt2 = createNodeRuntime();
    const id2 = await rt2.deviceIdProvider();
    expect(id2).toBe(id1);
  });

  it('honors XDG_CONFIG_HOME', async () => {
    const rt = createNodeRuntime();
    await rt.deviceIdProvider();
    // Config file should land under the XDG path
    const expectedDir = path.join(tmpRoot, 'a14y');
    const expectedFile = path.join(expectedDir, 'config.json');
    const { existsSync, readFileSync } = await import('fs');
    expect(existsSync(expectedFile)).toBe(true);
    const cfg = JSON.parse(readFileSync(expectedFile, 'utf8'));
    expect(typeof cfg.deviceId).toBe('string');
  });

  it('recovers from corrupted config.json by regenerating', async () => {
    const dir = path.join(tmpRoot, 'a14y');
    const { mkdirSync } = await import('fs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'config.json'), 'not json {{{');
    const rt = createNodeRuntime();
    const id = await rt.deviceIdProvider();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reads telemetryEnabled from config (default enabled)', async () => {
    const rt = createNodeRuntime();
    expect(await rt.configProvider.isEnabled()).toBe(true);
    await rt.configProvider.setEnabled(false);
    expect(await rt.configProvider.isEnabled()).toBe(false);
    const rt2 = createNodeRuntime();
    expect(await rt2.configProvider.isEnabled()).toBe(false);
  });

  it('persists firstRunNoticeShown', async () => {
    const rt = createNodeRuntime();
    expect(await rt.isFirstRunNoticeShown()).toBe(false);
    await rt.markFirstRunNoticeShown();
    expect(await rt.isFirstRunNoticeShown()).toBe(true);
    const rt2 = createNodeRuntime();
    expect(await rt2.isFirstRunNoticeShown()).toBe(true);
  });

  it('falls back to ephemeral when config dir cannot be written', async () => {
    // Make the parent dir read-only so mkdir fails.
    const { mkdirSync } = await import('fs');
    const parent = path.join(tmpRoot, 'locked');
    mkdirSync(parent);
    chmodSync(parent, 0o500);
    process.env.XDG_CONFIG_HOME = parent;

    try {
      const rt = createNodeRuntime();
      const id = await rt.deviceIdProvider();
      expect(typeof id).toBe('string');
      expect(rt.isEphemeral()).toBe(true);
      expect(await rt.configProvider.isEnabled()).toBe(false);
    } finally {
      chmodSync(parent, 0o700);
    }
  });
});
