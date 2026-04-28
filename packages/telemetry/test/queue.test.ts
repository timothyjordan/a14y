import { describe, it, expect } from 'vitest';
import { BoundedQueue } from '../src/core/queue';

describe('BoundedQueue', () => {
  it('drops the oldest entry when at capacity', () => {
    const q = new BoundedQueue<number>(3);
    q.push(1);
    q.push(2);
    q.push(3);
    q.push(4);
    expect(q.length).toBe(3);
    expect(q.drain(10)).toEqual([2, 3, 4]);
  });

  it('drains up to maxBatch and leaves the rest', () => {
    const q = new BoundedQueue<number>(10);
    for (let i = 0; i < 6; i++) q.push(i);
    expect(q.drain(4)).toEqual([0, 1, 2, 3]);
    expect(q.length).toBe(2);
    expect(q.drain(10)).toEqual([4, 5]);
    expect(q.length).toBe(0);
  });
});
