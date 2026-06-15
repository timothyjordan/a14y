import path from 'node:path';
import {
  AGENT_REGISTRY,
  agentByName,
  sharedSkillsDir,
  type AgentEntry,
  type PathCtx,
} from './registry';
import {
  skillDir,
  skillFile,
  SkillsConfigError,
  type Scope,
  type SkillTarget,
} from './paths';
import { parseSkillName, parseSkillVersion } from './frontmatter';
import type { FsFacade } from './fsFacade';

export type InstallMethod = 'copy' | 'link';

function requireBase(ctx: PathCtx, scope: Scope): void {
  if (scope === 'global' && !ctx.home) {
    throw new SkillsConfigError(
      'Could not determine your home directory. Pass --target <dir> or use --local.',
    );
  }
  if (scope === 'local' && !ctx.cwd) {
    throw new SkillsConfigError('Could not determine the current directory.');
  }
}

function agentSkillsDir(a: AgentEntry, scope: Scope, ctx: PathCtx): string {
  return scope === 'global' ? a.globalSkillsDir(ctx) : a.localSkillsDir(ctx);
}

/** Copy targets: a real SKILL.md in each agent's own skills dir (deduped). */
function buildCopyTargets(agents: AgentEntry[], scope: Scope, ctx: PathCtx): SkillTarget[] {
  const byPath = new Map<string, { agents: string[]; labels: string[] }>();
  for (const a of agents) {
    const file = skillFile(agentSkillsDir(a, scope, ctx));
    const hit = byPath.get(file);
    if (hit) {
      hit.agents.push(a.name);
      hit.labels.push(a.label);
    } else {
      byPath.set(file, { agents: [a.name], labels: [a.label] });
    }
  }
  return [...byPath.entries()].map(([managedPath, v]) => ({
    kind: 'copy' as const,
    agents: v.agents,
    label: v.labels.join(' + '),
    managedPath,
  }));
}

/**
 * Link targets: one canonical SKILL.md in the shared `.agents/skills` dir, plus
 * a symlink from every other agent's `a14y` dir to it. Agents whose skills dir
 * *is* the shared dir are served by the canonical directly (no extra symlink).
 */
function buildLinkTargets(agents: AgentEntry[], scope: Scope, ctx: PathCtx): SkillTarget[] {
  const shared = sharedSkillsDir(ctx, scope);
  const canonicalDir = skillDir(shared);
  const canonicalFile = skillFile(shared);

  const direct: string[] = [];
  const links = new Map<string, { agents: string[]; labels: string[] }>();
  for (const a of agents) {
    const dir = agentSkillsDir(a, scope, ctx);
    if (path.resolve(dir) === path.resolve(shared)) {
      direct.push(a.label);
      continue;
    }
    const linkPath = skillDir(dir);
    const hit = links.get(linkPath);
    if (hit) {
      hit.agents.push(a.name);
      hit.labels.push(a.label);
    } else {
      links.set(linkPath, { agents: [a.name], labels: [a.label] });
    }
  }

  const canonical: SkillTarget = {
    kind: 'canonical',
    agents: ['shared'],
    label: direct.length ? `Shared + ${direct.join(' + ')}` : 'Shared (.agents/skills)',
    managedPath: canonicalFile,
  };
  const linkTargets: SkillTarget[] = [...links.entries()].map(([managedPath, v]) => ({
    kind: 'link' as const,
    agents: v.agents,
    label: v.labels.join(' + '),
    managedPath,
    linkTo: canonicalDir,
  }));
  return [canonical, ...linkTargets];
}

/** Build install targets for the given agents, scope, and method. */
export function buildTargets(
  agents: AgentEntry[],
  scope: Scope,
  ctx: PathCtx,
  method: InstallMethod = 'copy',
): SkillTarget[] {
  requireBase(ctx, scope);
  return method === 'link'
    ? buildLinkTargets(agents, scope, ctx)
    : buildCopyTargets(agents, scope, ctx);
}

/** Detect which registered agents are configured under the given scope. */
export async function detectAgents(ctx: PathCtx, fs: FsFacade): Promise<AgentEntry[]> {
  const detected: AgentEntry[] = [];
  for (const a of AGENT_REGISTRY) {
    for (const dir of a.detectDirs(ctx)) {
      if (await fs.dirExists(dir)) {
        detected.push(a);
        break;
      }
    }
  }
  return detected;
}

/** Targets for an explicit `--agent <name>` selection. Throws on unknown names. */
export function agentTargets(
  names: string[],
  scope: Scope,
  ctx: PathCtx,
  method: InstallMethod = 'copy',
): SkillTarget[] {
  const agents: AgentEntry[] = [];
  for (const name of names) {
    const entry = agentByName(name);
    if (!entry) {
      const known = AGENT_REGISTRY.map((a) => a.name).join(', ');
      throw new SkillsConfigError(`Unknown agent "${name}". Known agents: ${known}.`);
    }
    if (!agents.includes(entry)) agents.push(entry);
  }
  return buildTargets(agents, scope, ctx, method);
}

/** Single target for an explicit `--target <dir>` (bypasses scope + registry). */
export function explicitTarget(dir: string, ctx: PathCtx): SkillTarget {
  const skillsDir = path.resolve(ctx.cwd || '.', dir);
  return {
    kind: 'copy',
    agents: ['custom'],
    label: `custom target (${dir})`,
    managedPath: skillFile(skillsDir),
  };
}

export interface RemovalTarget {
  agents: string[];
  label: string;
  /** The `a14y` directory or symlink to remove. */
  path: string;
  kind: 'link' | 'dir';
  version: string | null;
}

/**
 * Find every place the a14y skill is installed under the given scope — the
 * shared `.agents/skills` dir and each registered agent's skills dir — whether
 * it's a real copy or a symlink. Foreign `a14y` directories (not our skill) are
 * ignored so uninstall never deletes someone else's files.
 */
export async function scanInstalled(
  ctx: PathCtx,
  scope: Scope,
  fs: FsFacade,
): Promise<RemovalTarget[]> {
  requireBase(ctx, scope);
  // Candidate skills dirs: the shared dir plus every agent's own dir.
  const candidates: Array<{ skillsDir: string; label: string; agent: string }> = [
    { skillsDir: sharedSkillsDir(ctx, scope), label: 'Shared (.agents/skills)', agent: 'shared' },
    ...AGENT_REGISTRY.map((a) => ({
      skillsDir: agentSkillsDir(a, scope, ctx),
      label: a.label,
      agent: a.name,
    })),
  ];

  const byPath = new Map<
    string,
    { agents: string[]; labels: string[]; kind: 'link' | 'dir'; version: string | null }
  >();
  for (const c of candidates) {
    const dir = skillDir(c.skillsDir);
    const seen = byPath.get(dir);
    if (seen) {
      seen.agents.push(c.agent);
      seen.labels.push(c.label);
      continue;
    }
    const st = await fs.lstat(dir);
    if (!st) continue;
    if (st.isSymbolicLink) {
      byPath.set(dir, { agents: [c.agent], labels: [c.label], kind: 'link', version: null });
    } else if (st.isDirectory) {
      const content = await fs.readFile(skillFile(c.skillsDir));
      if (content && parseSkillName(content) === 'a14y') {
        byPath.set(dir, {
          agents: [c.agent],
          labels: [c.label],
          kind: 'dir',
          version: parseSkillVersion(content),
        });
      }
    }
  }

  return [...byPath.entries()].map(([p, v]) => ({
    agents: v.agents,
    label: v.labels.join(' + '),
    path: p,
    kind: v.kind,
    version: v.version,
  }));
}
