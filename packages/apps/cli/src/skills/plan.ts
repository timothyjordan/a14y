import { parseSkillName, parseSkillVersion } from './frontmatter';
import { SKILL_NAME } from './registry';
import type { SkillTarget } from './paths';

export type SkillAction = 'create' | 'update' | 'unchanged' | 'conflict';

export interface TargetPlan {
  target: SkillTarget;
  action: SkillAction;
  oldVersion: string | null;
  newVersion: string | null;
  isSymlink: boolean;
  /** Why a `conflict` was raised — surfaced to the user. */
  conflictReason?: string;
}

export interface PlanTargetInput {
  target: SkillTarget;
  /** Freshly downloaded SKILL.md body. */
  fetched: string;
  /** Current on-disk content, or null when the file is absent. */
  current: string | null;
  /** True when the file or its skill directory is a symlink. */
  isSymlink: boolean;
  /** `--force`: overwrite user-modified files and write through symlinks. */
  force: boolean;
}

/**
 * Decide what to do with one target. Idempotent: byte-identical content is a
 * no-op. We own files whose frontmatter `name` is `a14y`; a differing file that
 * isn't ours (or is a symlink we'd write through) is a conflict the user must
 * resolve with `--force`.
 */
export function planTarget(input: PlanTargetInput): TargetPlan {
  const { target, fetched, current, isSymlink, force } = input;
  const newVersion = parseSkillVersion(fetched);
  const oldVersion = current !== null ? parseSkillVersion(current) : null;

  let action: SkillAction;
  let conflictReason: string | undefined;

  if (current === null) {
    action = 'create';
  } else if (current === fetched) {
    action = 'unchanged';
  } else if (isSymlink && !force) {
    action = 'conflict';
    conflictReason = 'symlink — managed elsewhere; pass --force to write through it';
  } else if (parseSkillName(current) === SKILL_NAME && !isSymlink) {
    action = 'update';
  } else if (force) {
    action = 'update';
  } else {
    action = 'conflict';
    conflictReason = 'existing file looks user-modified; pass --force to overwrite';
  }

  return { target, action, oldVersion, newVersion, isSymlink, conflictReason };
}
