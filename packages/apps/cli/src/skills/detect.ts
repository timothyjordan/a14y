import path from 'node:path';
import {
  AGENT_REGISTRY,
  agentByName,
  type AgentEntry,
  type PathCtx,
} from './registry';
import { skillFile, SkillsConfigError, type Scope, type SkillTarget } from './paths';
import type { FsFacade } from './fsFacade';

function requireHome(ctx: PathCtx, scope: Scope): void {
  if (scope === 'global' && !ctx.home) {
    throw new SkillsConfigError(
      'Could not determine your home directory. Pass --target <dir> or use --local.',
    );
  }
  if (scope === 'local' && !ctx.cwd) {
    throw new SkillsConfigError('Could not determine the current directory.');
  }
}

/**
 * Turn a set of agents + scope into deduplicated install targets. Agents that
 * share a skills directory (e.g. several use `.agents/skills` project-locally)
 * collapse into one target whose `agents`/`label` list every contributor.
 */
export function buildTargets(agents: AgentEntry[], scope: Scope, ctx: PathCtx): SkillTarget[] {
  requireHome(ctx, scope);
  const byPath = new Map<
    string,
    { agents: string[]; labels: string[]; skillsDir: string; filePath: string }
  >();
  for (const a of agents) {
    const skillsDir = scope === 'global' ? a.globalSkillsDir(ctx) : a.localSkillsDir(ctx);
    const filePath = skillFile(skillsDir);
    const hit = byPath.get(filePath);
    if (hit) {
      hit.agents.push(a.name);
      hit.labels.push(a.label);
    } else {
      byPath.set(filePath, { agents: [a.name], labels: [a.label], skillsDir, filePath });
    }
  }
  return [...byPath.values()].map((t) => ({
    agents: t.agents,
    label: t.labels.join(' + '),
    skillsDir: t.skillsDir,
    filePath: t.filePath,
  }));
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
export function agentTargets(names: string[], scope: Scope, ctx: PathCtx): SkillTarget[] {
  const agents: AgentEntry[] = [];
  for (const name of names) {
    const entry = agentByName(name);
    if (!entry) {
      const known = AGENT_REGISTRY.map((a) => a.name).join(', ');
      throw new SkillsConfigError(`Unknown agent "${name}". Known agents: ${known}.`);
    }
    if (!agents.includes(entry)) agents.push(entry);
  }
  return buildTargets(agents, scope, ctx);
}

/** Single target for an explicit `--target <dir>` (bypasses scope + registry). */
export function explicitTarget(dir: string, ctx: PathCtx): SkillTarget {
  const skillsDir = path.resolve(ctx.cwd || '.', dir);
  return {
    agents: ['custom'],
    label: `custom target (${dir})`,
    skillsDir,
    filePath: skillFile(skillsDir),
  };
}
