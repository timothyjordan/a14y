import path from 'node:path';
import { SKILL_FILENAME, SKILL_NAME } from './registry';

export type Scope = 'global' | 'local';

export class SkillsConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillsConfigError';
  }
}

export type TargetKind = 'copy' | 'canonical' | 'link';

export interface SkillTarget {
  /**
   * - `copy`: a real SKILL.md written into the agent's own skills dir.
   * - `canonical`: the single shared SKILL.md (`.agents/skills/a14y/SKILL.md`)
   *   used by the symlink install mode.
   * - `link`: a symlink at an agent's `a14y` dir pointing at the canonical dir.
   */
  kind: TargetKind;
  /** Agent keys served by this target (>1 when they share a path). */
  agents: string[];
  /** Combined human label, e.g. "Cline + Zed". */
  label: string;
  /** copy/canonical: the SKILL.md file path. link: the `a14y` symlink path. */
  managedPath: string;
  /** link only: absolute canonical `a14y` directory the symlink points at. */
  linkTo?: string;
}

/** `<skillsDir>/a14y/SKILL.md`. */
export function skillFile(skillsDir: string): string {
  return path.join(skillsDir, SKILL_NAME, SKILL_FILENAME);
}

/** `<skillsDir>/a14y`. */
export function skillDir(skillsDir: string): string {
  return path.join(skillsDir, SKILL_NAME);
}
