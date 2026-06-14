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

function deps(fs: FakeFs, extra: Partial<RunSkillsDeps> = {}): RunSkillsDeps & {
  out: string[];
  err: string[];
  events: Array<[string, Record<string, unknown> | undefined]>;
} {
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
    track: (e, p) => events.push([e, p]),
    fetchImpl: vi.fn(async () => new Response(skill('0.2.0'), { status: 200 })),
    ...extra,
  };
}

const TARGET = '/work/out';
const FILE = path.join(TARGET, 'a14y', 'SKILL.md');

describe('runSkillsCommand', () => {
  it('creates the skill on a fresh install and reports JSON', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    const code = await runSkillsCommand({ target: TARGET, output: 'json' }, d);
    expect(code).toBe(0);
    expect(fs.files.get(FILE)).toBe(skill('0.2.0'));
    const json = JSON.parse(d.out.join('\n'));
    expect(json.summary.created).toBe(1);
    expect(json.targets[0].outcome).toBe('created');
  });

  it('is idempotent: a second run writes nothing', async () => {
    const fs = new FakeFs();
    fs.files.set(FILE, skill('0.2.0'));
    const d = deps(fs);
    const writeSpy = vi.spyOn(fs, 'writeFile');
    const code = await runSkillsCommand({ target: TARGET }, d);
    expect(code).toBe(0);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(d.out.join('\n')).toContain('Unchanged');
  });

  it('updates an older installed skill and surfaces old -> new', async () => {
    const fs = new FakeFs();
    fs.files.set(FILE, skill('0.1.0'));
    const d = deps(fs);
    const code = await runSkillsCommand({ target: TARGET, output: 'json' }, d);
    expect(code).toBe(0);
    const json = JSON.parse(d.out.join('\n'));
    expect(json.targets[0]).toMatchObject({ outcome: 'updated', oldVersion: '0.1.0', newVersion: '0.2.0' });
  });

  it('--check reports drift without writing and exits 1', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    const code = await runSkillsCommand({ target: TARGET, check: true }, d);
    expect(code).toBe(1);
    expect(fs.files.has(FILE)).toBe(false);
    expect(d.out.join('\n')).toContain('Would change');
  });

  it('--check exits 0 when already up to date', async () => {
    const fs = new FakeFs();
    fs.files.set(FILE, skill('0.2.0'));
    const code = await runSkillsCommand({ target: TARGET, check: true }, deps(fs));
    expect(code).toBe(0);
  });

  it('skips a user-modified file without --force (exit 1), overwrites with --force', async () => {
    const fs = new FakeFs();
    fs.files.set(FILE, 'hand written, not ours');
    const d1 = deps(fs);
    expect(await runSkillsCommand({ target: TARGET }, d1)).toBe(1);
    expect(fs.files.get(FILE)).toBe('hand written, not ours');
    expect(d1.out.join('\n')).toContain('Skipped');

    const d2 = deps(fs);
    expect(await runSkillsCommand({ target: TARGET, force: true }, d2)).toBe(0);
    expect(fs.files.get(FILE)).toBe(skill('0.2.0'));
  });

  it('skips a symlinked target without --force', async () => {
    const fs = new FakeFs();
    const skillDir = path.dirname(FILE);
    fs.symlinks.add(skillDir); // models the repo's .claude/skills/a14y symlink
    fs.files.set(FILE, skill('0.1.0'));
    const d = deps(fs);
    expect(await runSkillsCommand({ target: TARGET }, d)).toBe(1);
    expect(fs.files.get(FILE)).toBe(skill('0.1.0'));
    expect(d.out.join('\n')).toMatch(/symlink/);
  });

  it('returns 1 and reports the error when fetch fails, writing nothing', async () => {
    const fs = new FakeFs();
    const d = deps(fs, {
      fetchImpl: vi.fn(async () => new Response('nope', { status: 404 })),
    });
    const code = await runSkillsCommand({ target: TARGET }, d);
    expect(code).toBe(1);
    expect(fs.files.has(FILE)).toBe(false);
    expect(d.events.map((e) => e[0])).toContain('cli_error');
  });

  it('auto-detects configured agents under the global home dir', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.codex');
    const d = deps(fs);
    const code = await runSkillsCommand({ output: 'json' }, d);
    expect(code).toBe(0);
    const json = JSON.parse(d.out.join('\n'));
    expect(json.targets.map((t: { agent: string }) => t.agent).sort()).toEqual(['claude', 'codex']);
    expect(json.targets[0].path).toContain('/home/u/.claude/skills/a14y/SKILL.md');
  });

  it('falls back to Claude Code when no agent dir is detected', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    const code = await runSkillsCommand({ output: 'json' }, d);
    expect(code).toBe(0);
    const json = JSON.parse(d.out.join('\n'));
    expect(json.targets).toHaveLength(1);
    expect(json.targets[0].agent).toBe('claude');
    expect(json.targets[0].path).toBe('/home/u/.claude/skills/a14y/SKILL.md');
  });

  it('continues past a per-target write failure and exits 1', async () => {
    const fs = new FakeFs();
    fs.dirs.add('/home/u/.claude');
    fs.dirs.add('/home/u/.codex');
    fs.failWrite.add('/home/u/.codex/skills/a14y/SKILL.md');
    const d = deps(fs);
    const code = await runSkillsCommand({ output: 'json' }, d);
    expect(code).toBe(1);
    // Claude still got written; Codex errored.
    expect(fs.files.has('/home/u/.claude/skills/a14y/SKILL.md')).toBe(true);
    const json = JSON.parse(d.out.join('\n'));
    expect(json.summary.created).toBe(1);
    expect(json.summary.error).toBe(1);
  });

  it('rejects an unknown agent and a non-installable agent with exit 2', async () => {
    const fs = new FakeFs();
    expect(await runSkillsCommand({ agent: ['nope'] }, deps(fs))).toBe(2);
    expect(await runSkillsCommand({ agent: ['cursor'] }, deps(fs))).toBe(2);
  });

  it('emits cli_command_invoked with the resolved scope', async () => {
    const fs = new FakeFs();
    const d = deps(fs);
    await runSkillsCommand({ target: TARGET, local: true }, d);
    const invoked = d.events.find((e) => e[0] === 'cli_command_invoked');
    expect(invoked?.[1]).toMatchObject({ command: 'skills', scope: 'local', target_override: true });
  });
});
