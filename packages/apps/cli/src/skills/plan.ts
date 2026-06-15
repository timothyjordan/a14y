import path from 'node:path';
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

export interface FilePlanInput {
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
 * Plan a `copy`/`canonical` target (a real SKILL.md file). Idempotent:
 * byte-identical content is a no-op. We own files whose frontmatter `name` is
 * `a14y`; a differing foreign file (or a symlink we'd write through) is a
 * conflict the user resolves with `--force`.
 */
export function planFile(input: FilePlanInput): TargetPlan {
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

export interface LinkPlanInput {
  target: SkillTarget;
  /** Version of the freshly downloaded skill (for reporting). */
  fetchedVersion: string | null;
  /** Current state of the symlink path. */
  existing: { kind: 'absent' | 'symlink' | 'other'; linkTarget?: string | null };
  force: boolean;
}

/** Plan a `link` target (a symlink at an agent's `a14y` dir → the canonical dir). */
export function planLink(input: LinkPlanInput): TargetPlan {
  const { target, existing, force } = input;
  const base = {
    target,
    oldVersion: null,
    newVersion: input.fetchedVersion,
    isSymlink: existing.kind === 'symlink',
  };

  if (existing.kind === 'absent') {
    return { ...base, action: 'create' };
  }
  if (existing.kind === 'symlink') {
    const points = existing.linkTarget ?? '';
    if (target.linkTo && path.resolve(points) === path.resolve(target.linkTo)) {
      return { ...base, action: 'unchanged' };
    }
    return force
      ? { ...base, action: 'update' }
      : {
          ...base,
          action: 'conflict',
          conflictReason: 'symlink points elsewhere; pass --force to relink',
        };
  }
  // A real directory or file already lives here.
  return force
    ? { ...base, action: 'update' }
    : {
        ...base,
        action: 'conflict',
        conflictReason: 'a real directory exists here; pass --force to replace it with a symlink',
      };
}
