export interface RateLimiter {
  /** Consume one token for `key`. Returns false when the bucket is empty. */
  take(key: string): boolean;
}

export interface RateLimiterOptions {
  /** Bucket size: the most requests allowed in a burst. */
  capacity: number;
  /** Tokens added back per second. */
  refillPerSec: number;
  /** Clock injection point for tests. Defaults to Date.now. */
  now?: () => number;
}

/**
 * A small in-memory token-bucket limiter, keyed by client IP. Per-instance
 * only (Cloud Run may run several instances), so it blunts obvious abuse
 * rather than enforcing a global quota; the hard ceiling is `--max-instances`.
 */
export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const { capacity, refillPerSec } = opts;
  const now = opts.now ?? (() => Date.now());
  const buckets = new Map<string, { tokens: number; last: number }>();

  return {
    take(key: string): boolean {
      const t = now();
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { tokens: capacity, last: t };
        buckets.set(key, bucket);
      }
      const elapsedSec = (t - bucket.last) / 1000;
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
      bucket.last = t;
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
      }
      return false;
    },
  };
}
