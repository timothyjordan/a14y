import { describe, expect, it } from 'vitest';
import { planTarget } from '../src/skills/plan';
import type { SkillTarget } from '../src/skills/paths';

const target: SkillTarget = {
  agent: 'claude',
  label: 'Claude Code',
  skillsDir: '/home/u/.claude/skills',
  filePath: '/home/u/.claude/skills/a14y/SKILL.md',
};

const fetched = `---\nname: a14y\nmetadata:\n  version: "0.2.0"\n---\nnew body`;
const ours = (v: string) => `---\nname: a14y\nmetadata:\n  version: "${v}"\n---\nold body`;

function plan(current: string | null, extra: Partial<{ isSymlink: boolean; force: boolean }> = {}) {
  return planTarget({
    target,
    fetched,
    current,
    isSymlink: extra.isSymlink ?? false,
    force: extra.force ?? false,
  });
}

describe('planTarget', () => {
  it('creates when the file is absent', () => {
    const p = plan(null);
    expect(p.action).toBe('create');
    expect(p.oldVersion).toBeNull();
    expect(p.newVersion).toBe('0.2.0');
  });

  it('is unchanged for byte-identical content', () => {
    expect(plan(fetched).action).toBe('unchanged');
  });

  it('updates an existing a14y skill, surfacing old -> new', () => {
    const p = plan(ours('0.1.0'));
    expect(p.action).toBe('update');
    expect(p.oldVersion).toBe('0.1.0');
    expect(p.newVersion).toBe('0.2.0');
  });

  it('conflicts on a foreign/user-modified file without --force', () => {
    const p = plan('---\nname: something-else\n---\nhand written');
    expect(p.action).toBe('conflict');
    expect(p.conflictReason).toMatch(/user-modified/);
  });

  it('overwrites a foreign file with --force', () => {
    expect(plan('foreign', { force: true }).action).toBe('update');
  });

  it('conflicts on a symlink even when it is our skill', () => {
    const p = plan(ours('0.1.0'), { isSymlink: true });
    expect(p.action).toBe('conflict');
    expect(p.conflictReason).toMatch(/symlink/);
  });

  it('writes through a symlink with --force', () => {
    expect(plan(ours('0.1.0'), { isSymlink: true, force: true }).action).toBe('update');
  });
});
