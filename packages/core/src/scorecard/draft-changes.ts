import draftChangesJson from './draft-changes.json';

export type DraftChangeKind = 'added' | 'removed' | 'bumped';

export interface DraftChange {
  checkId: string;
  kind: DraftChangeKind;
  /** Previous implementation version. Present on `removed` and `bumped`. */
  fromImpl?: string;
  /** New implementation version. Present on `added` and `bumped`. */
  toImpl?: string;
  pr: number;
  prUrl: string;
  author: string;
  authorUrl: string;
  mergedAt: string;
}

export interface DraftChangesFile {
  /** Baseline published scorecard version the draft is diffed against. */
  since: string;
  changes: DraftChange[];
}

export function loadDraftChanges(): DraftChangesFile {
  const data = draftChangesJson as DraftChangesFile;
  return {
    since: data.since,
    changes: [...data.changes],
  };
}
