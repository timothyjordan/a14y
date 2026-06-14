import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveTargets, SkillsConfigError } from '../src/skills/paths';
import { INSTALLABLE_AGENTS, AGENT_REGISTRY } from '../src/skills/registry';

const claude = AGENT_REGISTRY.find((a) => a.name === 'claude')!;
const codex = AGENT_REGISTRY.find((a) => a.name === 'codex')!;

describe('resolveTargets', () => {
  it('maps global scope to home-dir agent paths', () => {
    const targets = resolveTargets({
      scope: 'global',
      homeDir: '/home/u',
      cwd: '/work',
      agents: [claude],
    });
    expect(targets).toHaveLength(1);
    expect(targets[0].filePath).toBe('/home/u/.claude/skills/a14y/SKILL.md');
    expect(targets[0].agent).toBe('claude');
  });

  it('maps local scope to cwd agent paths', () => {
    const targets = resolveTargets({
      scope: 'local',
      homeDir: '/home/u',
      cwd: '/work',
      agents: [claude],
    });
    expect(targets[0].filePath).toBe('/work/.claude/skills/a14y/SKILL.md');
  });

  it('returns one target per agent', () => {
    const targets = resolveTargets({
      scope: 'global',
      homeDir: '/home/u',
      cwd: '/work',
      agents: [claude, codex],
    });
    expect(targets.map((t) => t.agent)).toEqual(['claude', 'codex']);
  });

  it('honours an explicit --target, ignoring scope and the registry', () => {
    const targets = resolveTargets({
      scope: 'global',
      homeDir: '/home/u',
      cwd: '/work',
      agents: INSTALLABLE_AGENTS,
      explicitTarget: 'out/dir',
    });
    expect(targets).toHaveLength(1);
    expect(targets[0].agent).toBe('custom');
    expect(targets[0].filePath).toBe(path.resolve('/work', 'out/dir', 'a14y', 'SKILL.md'));
  });

  it('throws when global scope has no home dir', () => {
    expect(() =>
      resolveTargets({ scope: 'global', homeDir: '', cwd: '/work', agents: [claude] }),
    ).toThrow(SkillsConfigError);
  });
});
