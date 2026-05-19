import draftChangesJson from './draft-changes.json';

export type DraftChangeKind = 'added' | 'removed' | 'bumped' | 'methodology-bumped';

interface DraftChangeAttribution {
  pr: number;
  prUrl: string;
  author: string;
  authorUrl: string;
  mergedAt: string;
}

export type DraftCheckChange =
  | ({ kind: 'added'; checkId: string; toImpl: string } & DraftChangeAttribution)
  | ({ kind: 'removed'; checkId: string; fromImpl: string } & DraftChangeAttribution)
  | ({ kind: 'bumped'; checkId: string; fromImpl: string; toImpl: string } & DraftChangeAttribution);

export type DraftMethodologyChange = {
  kind: 'methodology-bumped';
  fromMethodology: string;
  toMethodology: string;
} & DraftChangeAttribution;

export type DraftChange = DraftCheckChange | DraftMethodologyChange;

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
