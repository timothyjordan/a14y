import { describe, expect, it } from 'vitest';
import { planFile, planLink } from '../src/skills/plan';
import type { SkillTarget } from '../src/skills/paths';

const fileTarget: SkillTarget = {
  kind: 'copy',
  agents: ['claude'],
  label: 'Claude Code',
  managedPath: '/home/u/.claude/skills/a14y/SKILL.md',
};

const fetched = `---\nname: a14y\nmetadata:\n  version: "0.2.0"\n---\nnew body`;
const ours = (v: string) => `---\nname: a14y\nmetadata:\n  version: "${v}"\n---\nold body`;

function file(current: string | null, extra: Partial<{ isSymlink: boolean; force: boolean }> = {}) {
  return planFile({
    target: fileTarget,
    fetched,
    current,
    isSymlink: extra.isSymlink ?? false,
    force: extra.force ?? false,
  });
}

describe('planFile', () => {
  it('creates when absent', () => {
    expect(file(null).action).toBe('create');
    expect(file(null).newVersion).toBe('0.2.0');
  });

  it('is unchanged for byte-identical content', () => {
    expect(file(fetched).action).toBe('unchanged');
  });

  it('updates an existing a14y skill, surfacing old -> new', () => {
    const p = file(ours('0.1.0'));
    expect(p.action).toBe('update');
    expect(p.oldVersion).toBe('0.1.0');
    expect(p.newVersion).toBe('0.2.0');
  });

  it('conflicts on a foreign file without --force, overwrites with --force', () => {
    expect(file('hand written').action).toBe('conflict');
    expect(file('hand written', { force: true }).action).toBe('update');
  });

  it('conflicts on a symlink unless --force', () => {
    expect(file(ours('0.1.0'), { isSymlink: true }).action).toBe('conflict');
    expect(file(ours('0.1.0'), { isSymlink: true, force: true }).action).toBe('update');
  });
});

const linkTarget: SkillTarget = {
  kind: 'link',
  agents: ['cursor'],
  label: 'Cursor',
  managedPath: '/home/u/.cursor/skills/a14y',
  linkTo: '/home/u/.agents/skills/a14y',
};

function link(
  existing: { kind: 'absent' | 'symlink' | 'other'; linkTarget?: string | null },
  force = false,
) {
  return planLink({ target: linkTarget, fetchedVersion: '0.2.0', existing, force });
}

describe('planLink', () => {
  it('creates when absent', () => {
    expect(link({ kind: 'absent' }).action).toBe('create');
  });

  it('is unchanged when the symlink already points at the canonical dir', () => {
    expect(link({ kind: 'symlink', linkTarget: '/home/u/.agents/skills/a14y' }).action).toBe(
      'unchanged',
    );
  });

  it('conflicts on a symlink pointing elsewhere unless --force', () => {
    expect(link({ kind: 'symlink', linkTarget: '/somewhere/else' }).action).toBe('conflict');
    expect(link({ kind: 'symlink', linkTarget: '/somewhere/else' }, true).action).toBe('update');
  });

  it('conflicts on a real directory unless --force', () => {
    expect(link({ kind: 'other' }).action).toBe('conflict');
    expect(link({ kind: 'other' }, true).action).toBe('update');
  });
});
