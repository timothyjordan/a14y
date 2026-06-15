import { describe, expect, it } from 'vitest';
import {
  agentTargets,
  buildTargets,
  detectAgents,
  explicitTarget,
} from '../src/skills/detect';
import { agentByName, type PathCtx } from '../src/skills/registry';
import { SkillsConfigError } from '../src/skills/paths';
import type { FsFacade } from '../src/skills/fsFacade';

const ctx: PathCtx = { home: '/home/u', cwd: '/work', env: {} };

function fsWithDirs(dirs: string[]): FsFacade {
  const set = new Set(dirs);
  return {
    async readFile() {
      return null;
    },
    async writeFile() {},
    async mkdirp() {},
    async lstat() {
      return null;
    },
    async dirExists(p) {
      return set.has(p);
    },
  };
}

describe('buildTargets', () => {
  it('resolves a global install to the agent home skills dir', () => {
    const [t] = buildTargets([agentByName('claude')!], 'global', ctx);
    expect(t.filePath).toBe('/home/u/.claude/skills/a14y/SKILL.md');
    expect(t.agents).toEqual(['claude']);
  });

  it('resolves a local install under the cwd', () => {
    const [t] = buildTargets([agentByName('windsurf')!], 'local', ctx);
    expect(t.filePath).toBe('/work/.windsurf/skills/a14y/SKILL.md');
  });

  it('dedupes agents that share a skills directory', () => {
    // Cline and Zed both use ~/.agents/skills globally.
    const targets = buildTargets(
      [agentByName('cline')!, agentByName('zed')!],
      'global',
      ctx,
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].filePath).toBe('/home/u/.agents/skills/a14y/SKILL.md');
    expect(targets[0].agents.sort()).toEqual(['cline', 'zed']);
    expect(targets[0].label).toContain('Cline');
    expect(targets[0].label).toContain('Zed');
  });

  it('honours CODEX_HOME and XDG_CONFIG_HOME overrides', () => {
    const envCtx: PathCtx = {
      home: '/home/u',
      cwd: '/work',
      env: { CODEX_HOME: '/custom/codex', XDG_CONFIG_HOME: '/cfg' },
    };
    expect(buildTargets([agentByName('codex')!], 'global', envCtx)[0].filePath).toBe(
      '/custom/codex/skills/a14y/SKILL.md',
    );
    expect(buildTargets([agentByName('opencode')!], 'global', envCtx)[0].filePath).toBe(
      '/cfg/opencode/skills/a14y/SKILL.md',
    );
  });

  it('throws when a global install has no home dir', () => {
    expect(() =>
      buildTargets([agentByName('claude')!], 'global', { home: '', cwd: '/w', env: {} }),
    ).toThrow(SkillsConfigError);
  });
});

describe('detectAgents', () => {
  it('detects agents whose marker dir exists', async () => {
    const fs = fsWithDirs(['/home/u/.claude', '/home/u/.gemini']);
    const found = (await detectAgents(ctx, fs)).map((a) => a.name);
    expect(found).toContain('claude');
    expect(found).toContain('gemini');
    expect(found).not.toContain('cursor');
  });

  it('detects Antigravity only via its nested marker, not plain Gemini', async () => {
    const onlyGemini = await detectAgents(ctx, fsWithDirs(['/home/u/.gemini']));
    expect(onlyGemini.map((a) => a.name)).not.toContain('antigravity');
    const withAg = await detectAgents(ctx, fsWithDirs(['/home/u/.gemini/antigravity']));
    expect(withAg.map((a) => a.name)).toContain('antigravity');
  });
});

describe('agentTargets / explicitTarget', () => {
  it('rejects an unknown agent name', () => {
    expect(() => agentTargets(['nope'], 'global', ctx)).toThrow(SkillsConfigError);
  });

  it('builds an explicit --target path, ignoring scope and the registry', () => {
    const t = explicitTarget('out/dir', ctx);
    expect(t.agents).toEqual(['custom']);
    expect(t.filePath).toBe('/work/out/dir/a14y/SKILL.md');
  });
});
