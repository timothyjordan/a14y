/**
 * Lightweight concurrent task queue with a fixed worker pool. We hand-roll
 * this instead of pulling p-queue's ESM-only build because @a14y/core
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
  private slotResolvers: Array<() => void> = [];
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

  /**
   * Resolves when `active + pending.length < maxInFlight`, i.e. once at
   * least one outside-task producer could safely call `add` without
   * pushing total in-flight work past `maxInFlight`. Used by the site
   * runner to backpressure its `for await` consumer against the
   * page-check queue so the queue's `pending` array does not balloon
   * with closures that each capture a full FetchedPage.
   *
   * Note: this only gates external producers. Tasks already running
   * inside the queue can still recursively call `add` without blocking
   * (the crawler does this for link expansion) — otherwise a worker
   * would deadlock waiting on capacity that only frees when it itself
   * finishes.
   */
  async waitForSlot(maxInFlight: number): Promise<void> {
    while (this.active + this.pending.length >= maxInFlight) {
      await new Promise<void>((resolve) => {
        this.slotResolvers.push(resolve);
      });
    }
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
      // Wake every slot-waiter so each can re-check its bound. Some may
      // re-arm themselves by pushing back into slotResolvers if their
      // requested bound is still exceeded.
      const slotWaiters = this.slotResolvers;
      this.slotResolvers = [];
      for (const r of slotWaiters) r();
    }
  }
}
