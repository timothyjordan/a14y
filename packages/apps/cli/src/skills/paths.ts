import path from 'node:path';
import { SKILL_FILENAME, SKILL_NAME } from './registry';

export type Scope = 'global' | 'local';

export class SkillsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillsConfigError';
  }
}

export interface SkillTarget {
  /** Agent keys that resolve to this file (>1 when they share a skills dir). */
  agents: string[];
  /** Combined human label, e.g. "Cline + Zed". */
  label: string;
  /** Directory that contains `<SKILL_NAME>/SKILL.md`. */
  skillsDir: string;
  /** Absolute path to the SKILL.md file we read/write. */
  filePath: string;
}

/** `<skillsDir>/a14y/SKILL.md`. */
export function skillFile(skillsDir: string): string {
  return path.join(skillsDir, SKILL_NAME, SKILL_FILENAME);
}
