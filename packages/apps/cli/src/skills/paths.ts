import path from 'node:path';
import { SKILL_FILENAME, SKILL_NAME, type AgentEntry } from './registry';

export type Scope = 'global' | 'local';

export class SkillsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillsConfigError';
  }
}

export interface SkillTarget {
  /** Agent key, or `custom` for an explicit `--target`. */
  agent: string;
  label: string;
  /** Directory that will contain `<SKILL_NAME>/SKILL.md`. */
  skillsDir: string;
  /** Absolute path to the SKILL.md file we read/write. */
  filePath: string;
}

export interface ResolveTargetsInput {
  scope: Scope;
  /** Injected `os.homedir()`. */
  homeDir: string;
  /** Injected `process.cwd()`. */
  cwd: string;
  /** Agents to install for (ignored when `explicitTarget` is set). */
  agents: AgentEntry[];
  /** `--target <dir>` escape hatch — bypasses the registry and scope. */
  explicitTarget?: string;
}

/** Turn agent + scope choices into concrete `.../a14y/SKILL.md` file paths. */
export function resolveTargets(input: ResolveTargetsInput): SkillTarget[] {
  if (input.explicitTarget) {
    const dir = path.resolve(input.cwd || '.', input.explicitTarget);
    return [
      {
        agent: 'custom',
        label: `custom target (${input.explicitTarget})`,
        skillsDir: dir,
        filePath: path.join(dir, SKILL_NAME, SKILL_FILENAME),
      },
    ];
  }

  const base = input.scope === 'global' ? input.homeDir : input.cwd;
  if (!base) {
    throw new SkillsConfigError(
      input.scope === 'global'
        ? 'Could not determine your home directory. Pass --target <dir> or use --local.'
        : 'Could not determine the current directory.',
    );
  }

  return input.agents.map((a) => {
    const skillsDir = path.join(base, a.skillsDir);
    return {
      agent: a.name,
      label: a.label,
      skillsDir,
      filePath: path.join(skillsDir, SKILL_NAME, SKILL_FILENAME),
    };
  });
}
