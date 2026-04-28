/** Bounded FIFO that drops the oldest entry when full. */
export class BoundedQueue<T> {
  private buf: T[] = [];

  constructor(private readonly max: number) {}

  push(item: T): void {
    if (this.buf.length >= this.max) this.buf.shift();
    this.buf.push(item);
  }

  drain(maxBatch: number): T[] {
    return this.buf.splice(0, maxBatch);
  }

  get length(): number {
    return this.buf.length;
  }
}
