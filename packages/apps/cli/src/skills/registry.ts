import path from 'node:path';

// The single a14y agent skill and the coding agents we install it for. Paths
// follow the agent-skills convention (a `skills/` directory of SKILL.md skills),
// which has converged across the ecosystem — so the same SKILL.md installs
// everywhere. Detection and path resolution take an injected context so the
// orchestrator stays pure and unit-testable.

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
  /** Human label for output. */
  label: string;
  /** Dirs whose existence marks the agent as configured (any match detects it). */
  detectDirs(ctx: PathCtx): string[];
  /** Absolute skills directory for a global (home) install. */
  globalSkillsDir(ctx: PathCtx): string;
  /** Absolute skills directory for a project-local install (under cwd). */
  localSkillsDir(ctx: PathCtx): string;
}

// Project-local convention shared by several agents (the `.agents/` standard).
const AGENTS_LOCAL = ['.agents', 'skills'];

function inHome(ctx: PathCtx, ...segs: string[]): string {
  return path.join(ctx.home, ...segs);
}
function inCwd(ctx: PathCtx, ...segs: string[]): string {
  return path.join(ctx.cwd, ...segs);
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
    localSkillsDir: (c) => inCwd(c, '.claude', 'skills'),
  },
  {
    name: 'cursor',
    label: 'Cursor',
    detectDirs: (c) => [inHome(c, '.cursor')],
    globalSkillsDir: (c) => inHome(c, '.cursor', 'skills'),
    localSkillsDir: (c) => inCwd(c, ...AGENTS_LOCAL),
  },
  {
    name: 'copilot',
    label: 'GitHub Copilot',
    detectDirs: (c) => [inHome(c, '.copilot')],
    globalSkillsDir: (c) => inHome(c, '.copilot', 'skills'),
    localSkillsDir: (c) => inCwd(c, ...AGENTS_LOCAL),
  },
  {
    name: 'gemini',
    label: 'Gemini CLI',
    detectDirs: (c) => [inHome(c, '.gemini')],
    globalSkillsDir: (c) => inHome(c, '.gemini', 'skills'),
    localSkillsDir: (c) => inCwd(c, ...AGENTS_LOCAL),
  },
  {
    name: 'codex',
    label: 'Codex',
    detectDirs: (c) => [codexHome(c)],
    globalSkillsDir: (c) => path.join(codexHome(c), 'skills'),
    localSkillsDir: (c) => inCwd(c, ...AGENTS_LOCAL),
  },
  {
    name: 'windsurf',
    label: 'Windsurf',
    detectDirs: (c) => [inHome(c, '.codeium', 'windsurf')],
    globalSkillsDir: (c) => inHome(c, '.codeium', 'windsurf', 'skills'),
    localSkillsDir: (c) => inCwd(c, '.windsurf', 'skills'),
  },
  {
    name: 'antigravity',
    label: 'Antigravity',
    detectDirs: (c) => [inHome(c, '.gemini', 'antigravity')],
    globalSkillsDir: (c) => inHome(c, '.gemini', 'antigravity', 'skills'),
    localSkillsDir: (c) => inCwd(c, ...AGENTS_LOCAL),
  },
  {
    name: 'cline',
    label: 'Cline',
    detectDirs: (c) => [inHome(c, '.cline')],
    globalSkillsDir: (c) => inHome(c, '.agents', 'skills'),
    localSkillsDir: (c) => inCwd(c, ...AGENTS_LOCAL),
  },
  {
    name: 'opencode',
    label: 'OpenCode',
    detectDirs: (c) => [path.join(xdgConfigHome(c), 'opencode')],
    globalSkillsDir: (c) => path.join(xdgConfigHome(c), 'opencode', 'skills'),
    localSkillsDir: (c) => inCwd(c, ...AGENTS_LOCAL),
  },
  {
    name: 'roo',
    label: 'Roo Code',
    detectDirs: (c) => [inHome(c, '.roo')],
    globalSkillsDir: (c) => inHome(c, '.roo', 'skills'),
    localSkillsDir: (c) => inCwd(c, '.roo', 'skills'),
  },
  {
    name: 'zed',
    label: 'Zed',
    detectDirs: (c) => [path.join(xdgConfigHome(c), 'zed')],
    globalSkillsDir: (c) => inHome(c, '.agents', 'skills'),
    localSkillsDir: (c) => inCwd(c, ...AGENTS_LOCAL),
  },
];

/** Fallback agent when nothing is auto-detected in a fresh environment. */
export const DEFAULT_AGENT = 'claude';

export function agentByName(name: string): AgentEntry | undefined {
  return AGENT_REGISTRY.find((a) => a.name === name);
}
