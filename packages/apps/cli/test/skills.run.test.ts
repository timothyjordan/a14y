import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runSkillsCommand, type RunSkillsDeps } from '../src/skills';
import type { FsFacade } from '../src/skills/fsFacade';

const skill = (v: string) => `---\nname: a14y\ndescription: d\nmetadata:\n  version: "${v}"\n---\nbody`;

/** In-memory FsFacade. Seed `dirs`/`symlinks`/`files` to model the disk. */
class FakeFs implements FsFacade {
  files = new Map<string, string>();
  dirs = new Set<string>();
  symlinks = new Set<string>();
  failWrite = new Set<string>();

  async readFile(p: string) {
    return this.files.has(p) ? this.files.get(p)! : null;
  }
  async writeFile(p: string, content: string) {
    if (this.failWrite.has(p)) throw new Error('EACCES: permission denied');
    this.files.set(p, content);
  }
  async mkdirp(p: string) {
    this.dirs.add(p);
  }
  async lstat(p: string) {
    if (this.symlinks.has(p)) return { isSymbolicLink: true };
    if (this.files.has(p) || this.dirs.has(p)) return { isSymbolicLink: false };
    return null;
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
    isTTY: false, // default: non-interactive (auto-select) unless a test overrides
    track: (e, p) => events.push([e, p]),
    fetchImpl: vi.fn(async () => new Response(skill('0.2.0'), { status: 200 })),
    ...extra,
  };
}

const TARGET = '/work/out';
const FILE = path.join(TARGET, 'a14y', 'SKILL.md');
const CLAUDE_FILE = '/home/u/.claude/skills/a14y/SKILL.md';
const GEMINI_FILE = '/home/u/.gemini/skills/a14y/SKILL.md';

function json(d: Captured) {
  return JSON.parse(d.out.join('\n'));
}

describe('runSkillsCommand — explicit --target', () => {
  it('creates on a fresh install and reports JSON', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    expect(await runSkillsCommand({ target: TARGET, output: 'json' }, d)).toBe(0);
    expect(fs.files.get(FILE)).toBe(skill('0.2.0'));
    expect(json(d).targets[0]).toMatchObject({ agents: ['custom'], outcome: 'created' });
  });

  it('is idempotent: a second run writes nothing (skill already installed)', async () => {
    const fs = new FakeFs();
    fs.files.set(FILE, skill('0.2.0'));
    const d = deps(fs);
    const writeSpy = vi.spyOn(fs, 'writeFile');
    expect(await runSkillsCommand({ target: TARGET }, d)).toBe(0);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(d.out.join('\n')).toContain('Up to date');
  });

  it('updates an older install and surfaces old -> new', async () => {
    const fs = new FakeFs();
    fs.files.set(FILE, skill('0.1.0'));
    const d = deps(fs);
    expect(await runSkillsCommand({ target: TARGET, output: 'json' }, d)).toBe(0);
    expect(json(d).targets[0]).toMatchObject({ outcome: 'updated', oldVersion: '0.1.0', newVersion: '0.2.0' });
  });

  it('--check reports drift without writing and exits 1', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    expect(await runSkillsCommand({ target: TARGET, check: true }, d)).toBe(1);
    expect(fs.files.has(FILE)).toBe(false);
    expect(d.out.join('\n')).toContain('Would change');
  });

  it('skips a user-modified file without --force, overwrites with --force', async () => {
    const fs = new FakeFs();
    fs.files.set(FILE, 'hand written, not ours');
    expect(await runSkillsCommand({ target: TARGET }, deps(fs))).toBe(1);
    expect(fs.files.get(FILE)).toBe('hand written, not ours');
    expect(await runSkillsCommand({ target: TARGET, force: true }, deps(fs))).toBe(0);
    expect(fs.files.get(FILE)).toBe(skill('0.2.0'));
  });

  it('skips a symlinked target without --force', async () => {
    const fs = new FakeFs();
    fs.symlinks.add(path.dirname(FILE)); // models the repo's .claude/skills/a14y symlink
    fs.files.set(FILE, skill('0.1.0'));
    const d = deps(fs);
    expect(await runSkillsCommand({ target: TARGET }, d)).toBe(1);
    expect(fs.files.get(FILE)).toBe(skill('0.1.0'));
    expect(d.out.join('\n')).toMatch(/symlink/);
  });

  it('returns 1 and writes nothing when the fetch fails', async () => {
    const fs = new FakeFs();
    const d = deps(fs, { fetchImpl: vi.fn(async () => new Response('nope', { status: 404 })) });
    expect(await runSkillsCommand({ target: TARGET }, d)).toBe(1);
    expect(fs.files.has(FILE)).toBe(false);
    expect(d.events.map((e) => e[0])).toContain('cli_error');
  });
});

describe('runSkillsCommand — auto-detect', () => {
  it('detects configured agents and installs to each', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.gemini');
    const d = deps(fs);
    expect(await runSkillsCommand({ output: 'json' }, d)).toBe(0);
    expect(fs.files.has(CLAUDE_FILE)).toBe(true);
    expect(fs.files.has(GEMINI_FILE)).toBe(true);
    expect(json(d).summary.created).toBe(2);
  });

  it('falls back to Claude Code when no agent is detected', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    expect(await runSkillsCommand({ output: 'json' }, d)).toBe(0);
    const j = json(d);
    expect(j.targets).toHaveLength(1);
    expect(j.targets[0].agents).toEqual(['claude']);
    expect(d.out.join('\n')).not.toContain('No configured agent'); // json mode: note is text-only
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

  it('is idempotent against a skill installed another way (same path, same content)', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.files.set(CLAUDE_FILE, skill('0.2.0')); // e.g. left by `npx skills add`
    const d = deps(fs);
    const writeSpy = vi.spyOn(fs, 'writeFile');
    expect(await runSkillsCommand({}, d)).toBe(0);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(d.out.join('\n')).toContain('Up to date');
  });
});

describe('runSkillsCommand — interactive checklist', () => {
  it('installs only the targets the user selects', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.gemini');
    // The selector picks Claude only, deselecting Gemini.
    const promptSelect = vi.fn(async () => [CLAUDE_FILE]);
    const d = deps(fs, { isTTY: true, promptSelect });
    expect(await runSkillsCommand({}, d)).toBe(0);
    expect(promptSelect).toHaveBeenCalledOnce();
    expect(fs.files.has(CLAUDE_FILE)).toBe(true);
    expect(fs.files.has(GEMINI_FILE)).toBe(false);
  });

  it('pre-checks not-installed/outdated targets and shows up-to-date as unchecked', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude'); // not installed -> pre-checked
    fs.dirs.add('/home/u/.gemini');
    fs.files.set(GEMINI_FILE, skill('0.2.0')); // up to date -> unchecked
    let seen: Array<{ value: string; selected: boolean }> = [];
    const promptSelect = vi.fn(async (_m: string, choices: Array<{ value: string; selected: boolean }>) => {
      seen = choices.map((c) => ({ value: c.value, selected: c.selected }));
      return choices.filter((c) => c.selected).map((c) => c.value);
    });
    const d = deps(fs, { isTTY: true, promptSelect });
    expect(await runSkillsCommand({}, d)).toBe(0);
    expect(seen.find((c) => c.value === CLAUDE_FILE)?.selected).toBe(true);
    expect(seen.find((c) => c.value === GEMINI_FILE)?.selected).toBe(false);
    expect(fs.files.has(CLAUDE_FILE)).toBe(true);
  });

  it('cancelling the checklist writes nothing and exits 0', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    const d = deps(fs, { isTTY: true, promptSelect: vi.fn(async () => null) });
    expect(await runSkillsCommand({}, d)).toBe(0);
    expect(fs.files.has(CLAUDE_FILE)).toBe(false);
    expect(d.out.join('\n')).toContain('Cancelled');
  });

  it('--yes skips the prompt and installs all detected', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.gemini');
    const promptSelect = vi.fn();
    const d = deps(fs, { isTTY: true, promptSelect });
    expect(await runSkillsCommand({ yes: true }, d)).toBe(0);
    expect(promptSelect).not.toHaveBeenCalled();
    expect(fs.files.has(CLAUDE_FILE)).toBe(true);
    expect(fs.files.has(GEMINI_FILE)).toBe(true);
  });
});

describe('runSkillsCommand — arguments + telemetry', () => {
  it('rejects an unknown agent with exit 2', async () => {
    expect(await runSkillsCommand({ agent: ['nope'] }, deps(new FakeFs()))).toBe(2);
  });

  it('installs Cursor via --agent (now a skills-format agent)', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    expect(await runSkillsCommand({ agent: ['cursor'], output: 'json' }, d)).toBe(0);
    expect(fs.files.has('/home/u/.cursor/skills/a14y/SKILL.md')).toBe(true);
  });

  it('rejects --global together with --local', async () => {
    expect(await runSkillsCommand({ target: TARGET, global: true, local: true }, deps(new FakeFs()))).toBe(2);
  });

  it('emits cli_command_invoked with scope and mode', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    await runSkillsCommand({ target: TARGET, local: true }, d);
    const invoked = d.events.find((e) => e[0] === 'cli_command_invoked');
    expect(invoked?.[1]).toMatchObject({ command: 'skills', scope: 'local', mode: 'target' });
  });
});
