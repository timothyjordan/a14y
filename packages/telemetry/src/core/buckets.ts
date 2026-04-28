export type ScoreBucket = '0-25' | '26-50' | '51-75' | '76-100';

export function bucketScore(n: number): ScoreBucket {
  if (!Number.isFinite(n) || n <= 25) return '0-25';
  if (n <= 50) return '26-50';
  if (n <= 75) return '51-75';
  return '76-100';
}

export type PageCountBucket = '1' | '2-10' | '11-50' | '51-200' | '200+';

export function bucketPageCount(n: number): PageCountBucket {
  if (!Number.isFinite(n) || n <= 1) return '1';
  if (n <= 10) return '2-10';
  if (n <= 50) return '11-50';
  if (n <= 200) return '51-200';
  return '200+';
}

export type IssueCountBucket = '0' | '1-2' | '3-5' | '6-10' | '11+';

export function bucketIssueCount(n: number): IssueCountBucket {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n <= 2) return '1-2';
  if (n <= 5) return '3-5';
  if (n <= 10) return '6-10';
  return '11+';
}

export type DurationBucket = 'lt_5s' | '5-30s' | '30s-2m' | '2-10m' | 'gt_10m';

export function bucketDurationMs(ms: number): DurationBucket {
  if (!Number.isFinite(ms) || ms < 5_000) return 'lt_5s';
  if (ms < 30_000) return '5-30s';
  if (ms < 120_000) return '30s-2m';
  if (ms < 600_000) return '2-10m';
  return 'gt_10m';
}
