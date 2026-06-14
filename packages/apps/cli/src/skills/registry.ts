// The single a14y agent skill and the agents we know how to install it for.
// Kept as plain data so `paths.ts` and the orchestrator can stay pure and
// unit-testable.

export const SKILL_NAME = 'a14y';
export const SKILL_FILENAME = 'SKILL.md';

export interface AgentEntry {
  /** Stable key used by `--agent`. */
  name: string;
  /** Human label for output. */
  label: string;
  /** Directory (relative to home or cwd) that holds `<SKILL_NAME>/SKILL.md`. */
  skillsDir: string;
  /** Marker directory used for auto-detection, e.g. `.claude`. */
  rootDir: string;
  /**
   * `false` for agents whose skill format differs from the SKILL.md-in-a-dir
   * convention (e.g. Cursor's `.cursor/rules/*.mdc`). We keep them in the
   * registry so the command can explain why they aren't auto-installed, but we
   * never copy SKILL.md verbatim into them.
   */
  installable: boolean;
}

export const AGENT_REGISTRY: AgentEntry[] = [
  { name: 'claude', label: 'Claude Code', skillsDir: '.claude/skills', rootDir: '.claude', installable: true },
  { name: 'codex', label: 'Codex', skillsDir: '.codex/skills', rootDir: '.codex', installable: true },
  { name: 'opencode', label: 'OpenCode', skillsDir: '.opencode/skills', rootDir: '.opencode', installable: true },
  // Different format — listed so `--agent cursor` can explain itself, never copied.
  { name: 'cursor', label: 'Cursor', skillsDir: '.cursor/rules', rootDir: '.cursor', installable: false },
];

/** Fallback agent when nothing is auto-detected in a fresh project. */
export const DEFAULT_AGENT = 'claude';

export const INSTALLABLE_AGENTS = AGENT_REGISTRY.filter((a) => a.installable);
