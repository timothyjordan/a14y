import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runSkillsCommand, type RunSkillsDeps } from '../src/skills';
import type { FsFacade } from '../src/skills/fsFacade';

const skill = (v: string) => `---\nname: a14y\ndescription: d\nmetadata:\n  version: "${v}"\n---\nbody`;

/** In-memory FsFacade with files, dirs, and symlinks. */
class FakeFs implements FsFacade {
  files = new Map<string, string>();
  dirs = new Set<string>();
  links = new Map<string, string>();
  failWrite = new Set<string>();

  async readFile(p: string) {
    return this.files.has(p) ? this.files.get(p)! : null;
  }
  async writeFile(p: string, content: string) {
    if (this.failWrite.has(p)) throw new Error('EACCES: permission denied');
    this.files.set(p, content);
  }
  async mkdirp(p: string) {
    let cur = p;
    while (cur && cur !== path.dirname(cur) && !this.dirs.has(cur)) {
      this.dirs.add(cur);
      cur = path.dirname(cur);
    }
  }
  async lstat(p: string) {
    if (this.links.has(p)) return { isSymbolicLink: true, isDirectory: false };
    if (this.files.has(p)) return { isSymbolicLink: false, isDirectory: false };
    if (this.dirs.has(p)) return { isSymbolicLink: false, isDirectory: true };
    return null;
  }
  async readlink(p: string) {
    return this.links.get(p) ?? null;
  }
  async symlink(target: string, linkPath: string) {
    this.links.set(linkPath, target);
  }
  async rm(p: string) {
    this.files.delete(p);
    this.dirs.delete(p);
    this.links.delete(p);
    const pref = p + path.sep;
    for (const k of [...this.files.keys()]) if (k.startsWith(pref)) this.files.delete(k);
    for (const k of [...this.dirs]) if (k.startsWith(pref)) this.dirs.delete(k);
    for (const k of [...this.links.keys()]) if (k.startsWith(pref)) this.links.delete(k);
  }
  async dirExists(p: string) {
    return this.dirs.has(p);
  }
}

interface Captured {
  out: string[];
  err: string[];
  events: Array<[string, Record<string, unknown> | undefined]>;
}

function deps(fs: FakeFs, extra: Partial<RunSkillsDeps> = {}): RunSkillsDeps & Captured {
  const out: string[] = [];
  const err: string[] = [];
  const events: Array<[string, Record<string, unknown> | undefined]> = [];
  return {
    out,
    err,
    events,
    stdout: (l) => out.push(l),
    stderr: (l) => err.push(l),
    fs,
    homeDir: '/home/u',
    cwd: '/work',
    env: {},
    isTTY: false,
    // Prompts default to safe stubs so a stray interactive path never blocks.
    promptChooseAgents: vi.fn(async (detected: { names: string[] }) => detected.names),
    promptLocation: vi.fn(async () => 'each-agent' as const),
    promptSelect: vi.fn(async (_m: string, choices: Array<{ value: string; selected: boolean }>) =>
      choices.filter((c) => c.selected).map((c) => c.value),
    ),
    track: (e, p) => events.push([e, p]),
    fetchImpl: vi.fn(async () => new Response(skill('0.2.0'), { status: 200 })),
    ...extra,
  };
}

const TARGET = '/work/out';
const TARGET_FILE = path.join(TARGET, 'a14y', 'SKILL.md');
const CLAUDE_FILE = '/home/u/.claude/skills/a14y/SKILL.md';
const GEMINI_FILE = '/home/u/.gemini/skills/a14y/SKILL.md';

const json = (d: Captured) => JSON.parse(d.out.join('\n'));

describe('skill install — explicit --target', () => {
  it('creates on a fresh install', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    expect(await runSkillsCommand({ target: TARGET, output: 'json' }, d)).toBe(0);
    expect(fs.files.get(TARGET_FILE)).toBe(skill('0.2.0'));
    expect(json(d).targets[0]).toMatchObject({ agents: ['custom'], outcome: 'created' });
  });

  it('is idempotent (skill already present, however installed)', async () => {
    const fs = new FakeFs();
    fs.files.set(TARGET_FILE, skill('0.2.0'));
    const d = deps(fs);
    const writeSpy = vi.spyOn(fs, 'writeFile');
    expect(await runSkillsCommand({ target: TARGET }, d)).toBe(0);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(d.out.join('\n')).toContain('Up to date');
  });

  it('updates an older install, surfacing old -> new', async () => {
    const fs = new FakeFs();
    fs.files.set(TARGET_FILE, skill('0.1.0'));
    const d = deps(fs);
    expect(await runSkillsCommand({ target: TARGET, output: 'json' }, d)).toBe(0);
    expect(json(d).targets[0]).toMatchObject({ outcome: 'updated', oldVersion: '0.1.0', newVersion: '0.2.0' });
  });

  it('--check reports drift without writing and exits 1', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    expect(await runSkillsCommand({ target: TARGET, check: true }, d)).toBe(1);
    expect(fs.files.has(TARGET_FILE)).toBe(false);
  });

  it('skips a foreign file without --force, overwrites with --force', async () => {
    const fs = new FakeFs();
    fs.files.set(TARGET_FILE, 'hand written');
    expect(await runSkillsCommand({ target: TARGET }, deps(fs))).toBe(1);
    expect(await runSkillsCommand({ target: TARGET, force: true }, deps(fs))).toBe(0);
    expect(fs.files.get(TARGET_FILE)).toBe(skill('0.2.0'));
  });

  it('returns 1 and writes nothing when the fetch fails', async () => {
    const fs = new FakeFs();
    const d = deps(fs, { fetchImpl: vi.fn(async () => new Response('x', { status: 404 })) });
    expect(await runSkillsCommand({ target: TARGET }, d)).toBe(1);
    expect(fs.files.has(TARGET_FILE)).toBe(false);
    expect(d.events.map((e) => e[0])).toContain('cli_error');
  });
});

describe('skill install — auto-detect (copy mode)', () => {
  it('installs a copy into each detected agent', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.gemini');
    const d = deps(fs);
    expect(await runSkillsCommand({ output: 'json' }, d)).toBe(0);
    expect(fs.files.has(CLAUDE_FILE)).toBe(true);
    expect(fs.files.has(GEMINI_FILE)).toBe(true);
    expect(json(d).summary.created).toBe(2);
  });

  it('falls back to Claude Code when nothing is detected', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    expect(await runSkillsCommand({ output: 'json' }, d)).toBe(0);
    expect(json(d).targets[0].agents).toEqual(['claude']);
  });

  it('continues past a per-target write failure and exits 1', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.gemini');
    fs.failWrite.add(GEMINI_FILE);
    const d = deps(fs);
    expect(await runSkillsCommand({ output: 'json' }, d)).toBe(1);
    expect(fs.files.has(CLAUDE_FILE)).toBe(true);
    expect(json(d).summary.error).toBe(1);
  });
});

describe('skill install — symlink mode (--link)', () => {
  it('writes one canonical copy and symlinks each agent to it', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.cursor');
    const d = deps(fs);
    expect(await runSkillsCommand({ link: true, output: 'json' }, d)).toBe(0);
    expect(fs.files.get('/home/u/.agents/skills/a14y/SKILL.md')).toBe(skill('0.2.0'));
    expect(fs.links.get('/home/u/.claude/skills/a14y')).toBe('/home/u/.agents/skills/a14y');
    expect(fs.links.get('/home/u/.cursor/skills/a14y')).toBe('/home/u/.agents/skills/a14y');
  });

  it('is idempotent: existing correct symlinks read as up to date', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.files.set('/home/u/.agents/skills/a14y/SKILL.md', skill('0.2.0'));
    fs.links.set('/home/u/.claude/skills/a14y', '/home/u/.agents/skills/a14y');
    const d = deps(fs);
    const symlinkSpy = vi.spyOn(fs, 'symlink');
    expect(await runSkillsCommand({ link: true }, d)).toBe(0);
    expect(symlinkSpy).not.toHaveBeenCalled();
    expect(d.out.join('\n')).toContain('Up to date');
  });
});

describe('skill — interactive picker', () => {
  it('installs only the harnesses chosen in the picker (each-agent copy)', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.gemini');
    const promptChooseAgents = vi.fn(async () => ['claude']);
    const promptLocation = vi.fn(async () => 'each-agent' as const);
    const d = deps(fs, { isTTY: true, promptChooseAgents, promptLocation });
    expect(await runSkillsCommand({}, d)).toBe(0);
    expect(promptChooseAgents).toHaveBeenCalledOnce();
    expect(fs.files.has(CLAUDE_FILE)).toBe(true); // ~/.claude/skills/a14y/SKILL.md
    expect(fs.files.has(GEMINI_FILE)).toBe(false);
  });

  it('shared-global location writes the canonical copy and symlinks each agent', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    const d = deps(fs, {
      isTTY: true,
      promptChooseAgents: vi.fn(async () => ['claude', 'cursor']),
      promptLocation: vi.fn(async () => 'global-shared' as const),
    });
    expect(await runSkillsCommand({}, d)).toBe(0);
    expect(fs.files.has('/home/u/.agents/skills/a14y/SKILL.md')).toBe(true);
    expect(fs.links.get('/home/u/.claude/skills/a14y')).toBe('/home/u/.agents/skills/a14y');
    expect(fs.links.get('/home/u/.cursor/skills/a14y')).toBe('/home/u/.agents/skills/a14y');
  });

  it('shows detected harnesses and offers the full supported list pre-checked by detection', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    let detected: { names: string[]; labels: string[] } | undefined;
    let choices: Array<{ name: string; selected: boolean }> = [];
    const promptChooseAgents = vi.fn(async (det: typeof detected, all: typeof choices) => {
      detected = det;
      choices = all;
      return det!.names;
    });
    const d = deps(fs, { isTTY: true, promptChooseAgents });
    await runSkillsCommand({}, d);
    expect(detected!.names).toEqual(['claude']);
    expect(choices).toHaveLength(11); // every supported harness is offered
    expect(choices.find((x) => x.name === 'claude')?.selected).toBe(true);
    expect(choices.find((x) => x.name === 'cursor')?.selected).toBe(false);
    expect(d.out.join('\n')).toContain('Detected harnesses:');
  });

  it('cancelling the harness picker changes nothing', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    const d = deps(fs, { isTTY: true, promptChooseAgents: vi.fn(async () => null) });
    expect(await runSkillsCommand({}, d)).toBe(0);
    expect(fs.files.size).toBe(0);
    expect(d.out.join('\n')).toContain('Cancelled');
  });

  it('cancelling the location prompt changes nothing', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    const d = deps(fs, {
      isTTY: true,
      promptChooseAgents: vi.fn(async (det: { names: string[] }) => det.names),
      promptLocation: vi.fn(async () => null),
    });
    expect(await runSkillsCommand({}, d)).toBe(0);
    expect(fs.files.size).toBe(0);
  });

  it('--yes skips both prompts and installs to all detected', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.gemini');
    const promptChooseAgents = vi.fn();
    const promptLocation = vi.fn();
    const d = deps(fs, { isTTY: true, yes: true, promptChooseAgents, promptLocation });
    expect(await runSkillsCommand({ yes: true }, d)).toBe(0);
    expect(promptChooseAgents).not.toHaveBeenCalled();
    expect(promptLocation).not.toHaveBeenCalled();
    expect(fs.files.has(CLAUDE_FILE)).toBe(true);
    expect(fs.files.has(GEMINI_FILE)).toBe(true);
  });
});

describe('skill install --project', () => {
  const P_CLAUDE = '/work/.claude/skills/a14y/SKILL.md';
  const P_CURSOR = '/work/.cursor/skills/a14y/SKILL.md';
  const P_AGENTS = '/work/.agents/skills/a14y/SKILL.md';

  it('non-interactively installs the default agents plus .agents into the cwd', async () => {
    const fs = new FakeFs();
    const d = deps(fs, { yes: true });
    expect(await runSkillsCommand({ project: true, yes: true, output: 'json' }, d)).toBe(0);
    // claude/cursor/copilot default agents + the shared .agents copy.
    expect(fs.files.has(P_CLAUDE)).toBe(true);
    expect(fs.files.has(P_CURSOR)).toBe(true);
    expect(fs.files.has('/work/.github/skills/a14y/SKILL.md')).toBe(true);
    expect(fs.files.has(P_AGENTS)).toBe(true);
  });

  it('shows the project directory and a how-to-switch note', async () => {
    const fs = new FakeFs();
    const d = deps(fs, { yes: true });
    await runSkillsCommand({ project: true, yes: true }, d);
    const out = d.out.join('\n');
    expect(out).toContain('Project directory: /work');
    expect(out).toContain('re-run from inside it');
  });

  it('interactive: writes only the chosen what + agents', async () => {
    const fs = new FakeFs();
    // 1st picker (what) -> per-agent + agents; 2nd picker (agents) -> claude only.
    const promptSelect = vi
      .fn()
      .mockResolvedValueOnce(['per-agent', 'agents'])
      .mockResolvedValueOnce(['claude']);
    const d = deps(fs, { isTTY: true, promptSelect });
    expect(await runSkillsCommand({ project: true }, d)).toBe(0);
    expect(promptSelect).toHaveBeenCalledTimes(2);
    expect(fs.files.has(P_CLAUDE)).toBe(true);
    expect(fs.files.has(P_AGENTS)).toBe(true);
    expect(fs.files.has(P_CURSOR)).toBe(false);
  });

  it('interactive: choosing only .agents skips the agent picker', async () => {
    const fs = new FakeFs();
    const promptSelect = vi.fn().mockResolvedValueOnce(['agents']);
    const d = deps(fs, { isTTY: true, promptSelect });
    expect(await runSkillsCommand({ project: true }, d)).toBe(0);
    expect(promptSelect).toHaveBeenCalledOnce(); // no second (agent) prompt
    expect(fs.files.has(P_AGENTS)).toBe(true);
    expect(fs.files.has(P_CLAUDE)).toBe(false);
  });

  it('honours --agent for the per-agent set', async () => {
    const fs = new FakeFs();
    const d = deps(fs, { yes: true });
    expect(await runSkillsCommand({ project: true, yes: true, agent: ['cursor'] }, d)).toBe(0);
    expect(fs.files.has(P_CURSOR)).toBe(true);
    expect(fs.files.has(P_CLAUDE)).toBe(false);
    expect(fs.files.has(P_AGENTS)).toBe(true);
  });

  it('cancelling the first picker changes nothing', async () => {
    const fs = new FakeFs();
    const d = deps(fs, { isTTY: true, promptSelect: vi.fn(async () => null) });
    expect(await runSkillsCommand({ project: true }, d)).toBe(0);
    expect(fs.files.size).toBe(0);
    expect(d.out.join('\n')).toContain('Cancelled');
  });
});

describe('skill install — tip', () => {
  it('points users at --project after a normal install', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    const d = deps(fs, { yes: true });
    await runSkillsCommand({ yes: true }, d);
    expect(d.out.join('\n')).toContain('a14y skill install --project');
  });
});

describe('skill uninstall', () => {
  it('removes a copy install', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude/skills/a14y');
    fs.files.set(CLAUDE_FILE, skill('0.2.0'));
    const d = deps(fs);
    expect(await runSkillsCommand({ action: 'uninstall', yes: true, output: 'json' }, d)).toBe(0);
    expect(fs.files.has(CLAUDE_FILE)).toBe(false);
    expect(json(d).summary.removed).toBe(1);
  });

  it('removes a symlink install', async () => {
    const fs = new FakeFs();
    fs.links.set('/home/u/.cursor/skills/a14y', '/home/u/.agents/skills/a14y');
    const d = deps(fs);
    expect(await runSkillsCommand({ action: 'uninstall', yes: true }, d)).toBe(0);
    expect(fs.links.has('/home/u/.cursor/skills/a14y')).toBe(false);
  });

  it('reports nothing to remove when not installed (exit 0)', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    expect(await runSkillsCommand({ action: 'uninstall' }, d)).toBe(0);
    expect(d.out.join('\n')).toMatch(/not installed/);
  });

  it('--check lists what would be removed and exits 1', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude/skills/a14y');
    fs.files.set(CLAUDE_FILE, skill('0.2.0'));
    const d = deps(fs);
    expect(await runSkillsCommand({ action: 'uninstall', check: true }, d)).toBe(1);
    expect(fs.files.has(CLAUDE_FILE)).toBe(true); // not actually removed
    expect(d.out.join('\n')).toContain('Remove');
  });

  it('ignores foreign a14y directories', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude/skills/a14y');
    fs.files.set(CLAUDE_FILE, '---\nname: someone-else\n---\nx');
    const d = deps(fs);
    expect(await runSkillsCommand({ action: 'uninstall', yes: true }, d)).toBe(0);
    expect(fs.files.has(CLAUDE_FILE)).toBe(true); // left alone
  });
});

describe('skill — arguments + telemetry', () => {
  it('defaults to install when no action is given', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    await runSkillsCommand({ target: TARGET }, d);
    const invoked = d.events.find((e) => e[0] === 'cli_command_invoked');
    expect(invoked?.[1]).toMatchObject({ command: 'skill', action: 'install' });
  });

  it('accepts the install/update/uninstall keywords and rejects others', async () => {
    expect(await runSkillsCommand({ action: 'install', target: TARGET }, deps(new FakeFs()))).toBe(0);
    expect(await runSkillsCommand({ action: 'update', target: TARGET }, deps(new FakeFs()))).toBe(0);
    expect(await runSkillsCommand({ action: 'frobnicate' }, deps(new FakeFs()))).toBe(2);
  });

  it('installs Cursor via --agent (a skills-format agent)', async () => {
    const fs = new FakeFs();
    expect(await runSkillsCommand({ agent: ['cursor'], output: 'json' }, deps(fs))).toBe(0);
    expect(fs.files.has('/home/u/.cursor/skills/a14y/SKILL.md')).toBe(true);
  });

  it('rejects an unknown agent and conflicting --link/--copy with exit 2', async () => {
    expect(await runSkillsCommand({ agent: ['nope'] }, deps(new FakeFs()))).toBe(2);
    expect(await runSkillsCommand({ link: true, copy: true }, deps(new FakeFs()))).toBe(2);
  });
});
