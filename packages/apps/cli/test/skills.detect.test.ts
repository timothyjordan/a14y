import { describe, expect, it } from 'vitest';
import {
  agentTargets,
  buildTargets,
  detectAgents,
  explicitTarget,
  scanInstalled,
} from '../src/skills/detect';
import { agentByName, type PathCtx } from '../src/skills/registry';
import { SkillsConfigError } from '../src/skills/paths';
import type { FsFacade } from '../src/skills/fsFacade';

const ctx: PathCtx = { home: '/home/u', cwd: '/work', env: {} };

type DirEntry = { isSymbolicLink: boolean; isDirectory: boolean };

function stubFs(opts: {
  dirs?: string[];
  files?: Record<string, string>;
  symlinks?: string[];
}): FsFacade {
  const dirs = new Set(opts.dirs ?? []);
  const files = new Map(Object.entries(opts.files ?? {}));
  const links = new Set(opts.symlinks ?? []);
  return {
    async readFile(p) {
      return files.has(p) ? files.get(p)! : null;
    },
    async writeFile() {},
    async mkdirp() {},
    async lstat(p): Promise<DirEntry | null> {
      if (links.has(p)) return { isSymbolicLink: true, isDirectory: false };
      if (files.has(p)) return { isSymbolicLink: false, isDirectory: false };
      if (dirs.has(p)) return { isSymbolicLink: false, isDirectory: true };
      return null;
    },
    async readlink() {
      return null;
    },
    async symlink() {},
    async rm() {},
    async dirExists(p) {
      return dirs.has(p);
    },
  };
}

describe('buildTargets — copy mode', () => {
  it('resolves a global copy to the agent home skills dir', () => {
    const [t] = buildTargets([agentByName('claude')!], 'global', ctx);
    expect(t.kind).toBe('copy');
    expect(t.managedPath).toBe('/home/u/.claude/skills/a14y/SKILL.md');
  });

  it('honours CODEX_HOME and XDG_CONFIG_HOME overrides', () => {
    const e: PathCtx = { home: '/home/u', cwd: '/work', env: { CODEX_HOME: '/cx', XDG_CONFIG_HOME: '/cfg' } };
    expect(buildTargets([agentByName('codex')!], 'global', e)[0].managedPath).toBe(
      '/cx/skills/a14y/SKILL.md',
    );
    expect(buildTargets([agentByName('opencode')!], 'global', e)[0].managedPath).toBe(
      '/cfg/opencode/skills/a14y/SKILL.md',
    );
  });

  it('throws when a global install has no home dir', () => {
    expect(() =>
      buildTargets([agentByName('claude')!], 'global', { home: '', cwd: '/w', env: {} }),
    ).toThrow(SkillsConfigError);
  });
});

describe('buildTargets — link mode', () => {
  it('emits one canonical target plus a symlink per agent', () => {
    const targets = buildTargets(
      [agentByName('claude')!, agentByName('cursor')!],
      'global',
      ctx,
      'link',
    );
    const canonical = targets.find((t) => t.kind === 'canonical')!;
    expect(canonical.managedPath).toBe('/home/u/.agents/skills/a14y/SKILL.md');
    const links = targets.filter((t) => t.kind === 'link');
    expect(links.map((l) => l.managedPath).sort()).toEqual([
      '/home/u/.claude/skills/a14y',
      '/home/u/.cursor/skills/a14y',
    ]);
    expect(links[0].linkTo).toBe('/home/u/.agents/skills/a14y');
  });

  it('folds agents that already use .agents/skills into the canonical (no extra link)', () => {
    // Cline + Zed both resolve to ~/.agents/skills globally.
    const targets = buildTargets(
      [agentByName('cline')!, agentByName('zed')!],
      'global',
      ctx,
      'link',
    );
    expect(targets).toHaveLength(1);
    expect(targets[0].kind).toBe('canonical');
    expect(targets[0].label).toContain('Cline');
    expect(targets[0].label).toContain('Zed');
  });
});

describe('detectAgents', () => {
  it('detects agents whose marker dir exists', async () => {
    const fs = stubFs({ dirs: ['/home/u/.claude', '/home/u/.gemini'] });
    const found = (await detectAgents(ctx, fs)).map((a) => a.name);
    expect(found).toEqual(expect.arrayContaining(['claude', 'gemini']));
    expect(found).not.toContain('cursor');
  });

  it('detects Antigravity only via its nested marker', async () => {
    expect((await detectAgents(ctx, stubFs({ dirs: ['/home/u/.gemini'] }))).map((a) => a.name)).not.toContain(
      'antigravity',
    );
    expect(
      (await detectAgents(ctx, stubFs({ dirs: ['/home/u/.gemini/antigravity'] }))).map((a) => a.name),
    ).toContain('antigravity');
  });
});

describe('agentTargets / explicitTarget', () => {
  it('rejects an unknown agent name', () => {
    expect(() => agentTargets(['nope'], 'global', ctx)).toThrow(SkillsConfigError);
  });

  it('builds an explicit --target path', () => {
    const t = explicitTarget('out/dir', ctx);
    expect(t.agents).toEqual(['custom']);
    expect(t.managedPath).toBe('/work/out/dir/a14y/SKILL.md');
  });
});

describe('scanInstalled', () => {
  const skill = `---\nname: a14y\nmetadata:\n  version: "0.2.0"\n---\nbody`;

  it('finds copy installs (our dirs) and ignores foreign a14y dirs', async () => {
    const fs = stubFs({
      dirs: ['/home/u/.claude/skills/a14y', '/home/u/.gemini/skills/a14y'],
      files: {
        '/home/u/.claude/skills/a14y/SKILL.md': skill,
        '/home/u/.gemini/skills/a14y/SKILL.md': '---\nname: not-ours\n---\nx',
      },
    });
    const found = await scanInstalled(ctx, 'global', fs);
    const paths = found.map((f) => f.path);
    expect(paths).toContain('/home/u/.claude/skills/a14y');
    expect(paths).not.toContain('/home/u/.gemini/skills/a14y'); // foreign, left alone
    expect(found.find((f) => f.path === '/home/u/.claude/skills/a14y')).toMatchObject({
      kind: 'dir',
      version: '0.2.0',
    });
  });

  it('finds symlink installs', async () => {
    const fs = stubFs({ symlinks: ['/home/u/.cursor/skills/a14y'] });
    const found = await scanInstalled(ctx, 'global', fs);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ path: '/home/u/.cursor/skills/a14y', kind: 'link' });
  });

  it('returns nothing when the skill is not installed', async () => {
    expect(await scanInstalled(ctx, 'global', stubFs({}))).toEqual([]);
  });
});
