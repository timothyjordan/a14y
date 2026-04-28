import { describe, it, expect } from 'vitest';
import {
  bucketScore,
  bucketPageCount,
  bucketIssueCount,
  bucketDurationMs,
} from '../src/core/buckets';

describe('bucketScore', () => {
  it.each([
    [-5, '0-25'],
    [0, '0-25'],
    [25, '0-25'],
    [26, '26-50'],
    [50, '26-50'],
    [51, '51-75'],
    [75, '51-75'],
    [76, '76-100'],
    [100, '76-100'],
    [Number.NaN, '0-25'],
    [Infinity, '0-25'],
  ])('%s -> %s', (n, expected) => {
    expect(bucketScore(n)).toBe(expected);
  });
});

describe('bucketPageCount', () => {
  it.each([
    [0, '1'],
    [1, '1'],
    [2, '2-10'],
    [10, '2-10'],
    [11, '11-50'],
    [50, '11-50'],
    [51, '51-200'],
    [200, '51-200'],
    [201, '200+'],
    [10_000, '200+'],
  ])('%s -> %s', (n, expected) => {
    expect(bucketPageCount(n)).toBe(expected);
  });
});

describe('bucketIssueCount', () => {
  it.each([
    [0, '0'],
    [1, '1-2'],
    [2, '1-2'],
    [3, '3-5'],
    [5, '3-5'],
    [6, '6-10'],
    [10, '6-10'],
    [11, '11+'],
    [99, '11+'],
  ])('%s -> %s', (n, expected) => {
    expect(bucketIssueCount(n)).toBe(expected);
  });
});

describe('bucketDurationMs', () => {
  it.each([
    [0, 'lt_5s'],
    [4_999, 'lt_5s'],
    [5_000, '5-30s'],
    [29_999, '5-30s'],
    [30_000, '30s-2m'],
    [119_999, '30s-2m'],
    [120_000, '2-10m'],
    [599_999, '2-10m'],
    [600_000, 'gt_10m'],
    [3_600_000, 'gt_10m'],
  ])('%s ms -> %s', (n, expected) => {
    expect(bucketDurationMs(n)).toBe(expected);
  });
});
