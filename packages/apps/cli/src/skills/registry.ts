import path from 'node:path';

// The single a14y agent skill and the coding agents ("harnesses") we install it
// for. Paths follow the agent-skills convention (a `skills/` directory of
// SKILL.md skills). Detection and path resolution take an injected context so
// the orchestrator stays pure and unit-testable.

export const SKILL_NAME = 'a14y';
export const SKILL_FILENAME = 'SKILL.md';

export interface PathCtx {
  /** Home directory (injected `os.homedir()`). */
  home: string;
  /** Current working directory (injected `process.cwd()`). */
  cwd: string;
  /** Environment (injected `process.env`) for XDG / agent-specific overrides. */
  env: Record<string, string | undefined>;
}

export interface AgentEntry {
  /** Stable key used by `--agent`. */
  name: string;
  /** Human label for output, e.g. "Claude Code". */
  label: string;
  /** Dirs whose existence marks the agent as configured (any match detects it). */
  detectDirs(ctx: PathCtx): string[];
  /** Absolute skills directory for a global (home) install. */
  globalSkillsDir(ctx: PathCtx): string;
  /** Relative skills dir for a project-local install + the label shown in the
   *  harness picker, e.g. ".cursor/skills". */
  localDir: string;
}

function inHome(ctx: PathCtx, ...segs: string[]): string {
  return path.join(ctx.home, ...segs);
}
function xdgConfigHome(ctx: PathCtx): string {
  const x = ctx.env.XDG_CONFIG_HOME?.trim();
  return x ? x : path.join(ctx.home, '.config');
}
function claudeConfigDir(ctx: PathCtx): string {
  const c = ctx.env.CLAUDE_CONFIG_DIR?.trim();
  return c ? c : inHome(ctx, '.claude');
}
function codexHome(ctx: PathCtx): string {
  const c = ctx.env.CODEX_HOME?.trim();
  return c ? c : inHome(ctx, '.codex');
}

export const AGENT_REGISTRY: AgentEntry[] = [
  {
    name: 'claude',
    label: 'Claude Code',
    detectDirs: (c) => [claudeConfigDir(c)],
    globalSkillsDir: (c) => path.join(claudeConfigDir(c), 'skills'),
    localDir: '.claude/skills',
  },
  {
    name: 'cursor',
    label: 'Cursor',
    detectDirs: (c) => [inHome(c, '.cursor')],
    globalSkillsDir: (c) => inHome(c, '.cursor', 'skills'),
    localDir: '.cursor/skills',
  },
  {
    name: 'copilot',
    label: 'GitHub Copilot',
    detectDirs: (c) => [inHome(c, '.copilot')],
    globalSkillsDir: (c) => inHome(c, '.copilot', 'skills'),
    localDir: '.github/skills',
  },
  {
    name: 'gemini',
    label: 'Gemini CLI',
    detectDirs: (c) => [inHome(c, '.gemini')],
    globalSkillsDir: (c) => inHome(c, '.gemini', 'skills'),
    localDir: '.gemini/skills',
  },
  {
    name: 'codex',
    label: 'Codex',
    detectDirs: (c) => [codexHome(c)],
    globalSkillsDir: (c) => path.join(codexHome(c), 'skills'),
    localDir: '.agents/skills',
  },
  {
    name: 'windsurf',
    label: 'Windsurf',
    detectDirs: (c) => [inHome(c, '.codeium', 'windsurf')],
    globalSkillsDir: (c) => inHome(c, '.codeium', 'windsurf', 'skills'),
    localDir: '.windsurf/skills',
  },
  {
    name: 'antigravity',
    label: 'Antigravity',
    detectDirs: (c) => [inHome(c, '.gemini', 'antigravity')],
    globalSkillsDir: (c) => inHome(c, '.gemini', 'antigravity', 'skills'),
    localDir: '.agents/skills',
  },
  {
    name: 'cline',
    label: 'Cline',
    detectDirs: (c) => [inHome(c, '.cline')],
    globalSkillsDir: (c) => inHome(c, '.agents', 'skills'),
    localDir: '.agents/skills',
  },
  {
    name: 'opencode',
    label: 'OpenCode',
    detectDirs: (c) => [path.join(xdgConfigHome(c), 'opencode')],
    globalSkillsDir: (c) => path.join(xdgConfigHome(c), 'opencode', 'skills'),
    localDir: '.opencode/skills',
  },
  {
    name: 'roo',
    label: 'Roo Code',
    detectDirs: (c) => [inHome(c, '.roo')],
    globalSkillsDir: (c) => inHome(c, '.roo', 'skills'),
    localDir: '.roo/skills',
  },
  {
    name: 'zed',
    label: 'Zed',
    detectDirs: (c) => [path.join(xdgConfigHome(c), 'zed')],
    globalSkillsDir: (c) => inHome(c, '.agents', 'skills'),
    localDir: '.agents/skills',
  },
];

/** Absolute project-local skills dir for an agent. */
export function localSkillsDir(a: AgentEntry, ctx: PathCtx): string {
  return path.join(ctx.cwd, ...a.localDir.split('/'));
}

/** Fallback agent when nothing is auto-detected in a fresh environment. */
export const DEFAULT_AGENT = 'claude';

export function agentByName(name: string): AgentEntry | undefined {
  return AGENT_REGISTRY.find((a) => a.name === name);
}

/**
 * The shared cross-agent skills directory (the `.agents/skills` standard). Used
 * as the canonical home for the symlink install mode: the skill lives here once
 * and each agent links to it.
 */
export function sharedSkillsDir(ctx: PathCtx, scope: 'global' | 'local'): string {
  return scope === 'global'
    ? inHome(ctx, '.agents', 'skills')
    : path.join(ctx.cwd, '.agents', 'skills');
}
