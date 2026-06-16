import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../src/rate-limit';

describe('createRateLimiter', () => {
  it('allows up to capacity then blocks', () => {
    let t = 0;
    const rl = createRateLimiter({ capacity: 3, refillPerSec: 1, now: () => t });
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);
  });

  it('refills over time', () => {
    let t = 0;
    const rl = createRateLimiter({ capacity: 2, refillPerSec: 1, now: () => t });
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);
    t = 1000; // 1 second -> +1 token
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);
  });

  it('tracks buckets per key independently', () => {
    let t = 0;
    const rl = createRateLimiter({ capacity: 1, refillPerSec: 1, now: () => t });
    expect(rl.take('a')).toBe(true);
    expect(rl.take('a')).toBe(false);
    expect(rl.take('b')).toBe(true);
  });
});
