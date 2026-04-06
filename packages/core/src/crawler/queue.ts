/**
 * Lightweight concurrent task queue with a fixed worker pool. We hand-roll
 * this instead of pulling p-queue's ESM-only build because @agentready/core
 * compiles to CJS for the CLI and bundles to a service worker for the
 * extension; either consumer would otherwise need ESM interop config.
 *
 * The semantics are exactly what the crawler needs: enqueue an arbitrary
 * number of tasks, run up to `concurrency` at a time, optionally sleep
 * between starts on the same domain (politeness), and resolve when the
 * queue empties.
 */
export interface ConcurrentQueueOptions {
  concurrency: number;
  /** Minimum milliseconds to wait between successive task starts. */
  politeDelayMs?: number;
}

export class ConcurrentQueue {
  private active = 0;
  private readonly pending: Array<() => Promise<void>> = [];
  private idleResolvers: Array<() => void> = [];
  private lastStart = 0;

  constructor(private readonly opts: ConcurrentQueueOptions) {}

  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const wrapped = async () => {
        try {
          const value = await task();
          resolve(value);
        } catch (err) {
          reject(err);
        }
      };
      this.pending.push(wrapped);
      this.tryDrain();
    });
  }

  /** Resolves once every queued task has finished. */
  async onIdle(): Promise<void> {
    if (this.active === 0 && this.pending.length === 0) return;
    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private tryDrain(): void {
    while (this.active < this.opts.concurrency && this.pending.length > 0) {
      const next = this.pending.shift()!;
      this.active++;
      this.startWithDelay(next);
    }
  }

  private async startWithDelay(task: () => Promise<void>): Promise<void> {
    const delay = this.opts.politeDelayMs ?? 0;
    if (delay > 0) {
      const elapsed = Date.now() - this.lastStart;
      if (elapsed < delay) {
        await new Promise((r) => setTimeout(r, delay - elapsed));
      }
    }
    this.lastStart = Date.now();
    try {
      await task();
    } finally {
      this.active--;
      if (this.active === 0 && this.pending.length === 0) {
        const resolvers = this.idleResolvers;
        this.idleResolvers = [];
        for (const r of resolvers) r();
      } else {
        this.tryDrain();
      }
    }
  }
}
