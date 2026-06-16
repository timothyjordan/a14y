import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { globalInstall, runInstallCommand, type RunInstallDeps } from '../src/install';
import type { RunSkillsOptions } from '../src/skills';

interface Captured {
  out: string[];
  err: string[];
  events: Array<[string, Record<string, unknown> | undefined]>;
  order: string[];
}

function deps(extra: Partial<RunInstallDeps> = {}): RunInstallDeps & Captured {
  const out: string[] = [];
  const err: string[] = [];
  const events: Array<[string, Record<string, unknown> | undefined]> = [];
  const order: string[] = [];
  return {
    out,
    err,
    events,
    order,
    stdout: (l) => out.push(l),
    stderr: (l) => err.push(l),
    track: (e, p) => events.push([e, p]),
    installGlobally: vi.fn(async () => {
      order.push('global');
      return 0;
    }),
    runSkill: vi.fn(async () => {
      order.push('skill');
      return 0;
    }),
    ...extra,
  };
}

describe('runInstallCommand', () => {
  it('installs globally first, then the skill, and exits 0', async () => {
    const d = deps();
    expect(await runInstallCommand({}, d)).toBe(0);
    expect(d.order).toEqual(['global', 'skill']);
    expect(d.events.find((e) => e[0] === 'cli_command_invoked')?.[1]).toMatchObject({
      command: 'install',
    });
  });

  it('forwards options with action "install" to the skill step', async () => {
    const runSkill = vi.fn(async () => 0);
    const d = deps({ runSkill });
    const opts: RunSkillsOptions = { project: true, yes: true, output: 'json' };
    await runInstallCommand(opts, d);
    expect(runSkill).toHaveBeenCalledWith(
      expect.objectContaining({ project: true, yes: true, output: 'json', action: 'install' }),
      d,
    );
  });

  it('still runs the skill install when the global install fails, exiting 1', async () => {
    const order: string[] = [];
    const d = deps({
      installGlobally: vi.fn(async () => {
        order.push('global');
        return 1;
      }),
      runSkill: vi.fn(async () => {
        order.push('skill');
        return 0;
      }),
    });
    d.order = order;
    expect(await runInstallCommand({}, d)).toBe(1);
    expect(order).toEqual(['global', 'skill']); // skill still ran
    expect(d.err.join('\n')).toContain('npm install -g a14y');
    expect(d.events.map((e) => e[0])).toContain('cli_error');
  });

  it('returns the skill exit code when the skill step fails', async () => {
    const d = deps({ runSkill: vi.fn(async () => 2) });
    expect(await runInstallCommand({}, d)).toBe(2);
  });

  it('--check skips the global install and previews the skill', async () => {
    const installGlobally = vi.fn(async () => 0);
    const runSkill = vi.fn(async () => 0);
    const d = deps({ installGlobally, runSkill });
    await runInstallCommand({ check: true }, d);
    expect(installGlobally).not.toHaveBeenCalled();
    expect(runSkill).toHaveBeenCalledWith(
      expect.objectContaining({ check: true, action: 'install' }),
      d,
    );
  });
});

describe('globalInstall', () => {
  const saved = process.env.A14Y_INSTALL_SKIP_GLOBAL;
  beforeEach(() => {
    delete process.env.A14Y_INSTALL_SKIP_GLOBAL;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.A14Y_INSTALL_SKIP_GLOBAL;
    else process.env.A14Y_INSTALL_SKIP_GLOBAL = saved;
  });

  it('spawns `npm install -g a14y` and returns its exit code', async () => {
    const spawnImpl = vi.fn(async () => 0);
    expect(await globalInstall(spawnImpl)).toBe(0);
    expect(spawnImpl).toHaveBeenCalledTimes(1);
    const [cmd, args] = spawnImpl.mock.calls[0];
    expect(cmd).toMatch(/npm/);
    expect(args).toEqual(['install', '-g', 'a14y']);
  });

  it('propagates a non-zero npm exit code', async () => {
    expect(await globalInstall(vi.fn(async () => 243))).toBe(243);
  });

  it('skips the spawn when A14Y_INSTALL_SKIP_GLOBAL=1', async () => {
    process.env.A14Y_INSTALL_SKIP_GLOBAL = '1';
    const spawnImpl = vi.fn(async () => 1);
    expect(await globalInstall(spawnImpl)).toBe(0);
    expect(spawnImpl).not.toHaveBeenCalled();
  });
});
