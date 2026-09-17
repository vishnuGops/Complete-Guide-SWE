/**
 * A fixed-width queue for judge runs.
 *
 * Compiling and running user code is CPU- and memory-hungry; a few concurrent
 * Submits would otherwise start enough JVMs to make every one of them time out,
 * turning a busy moment into a wave of false TLE verdicts. Queueing keeps
 * timings meaningful, which matters more here than throughput - this is a
 * single-user local app.
 */
export class RunQueue {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private limit: number) {
    if (limit < 1) throw new RangeError('queue limit must be at least 1');
  }

  get size(): number {
    return this.active + this.waiting.length;
  }

  get running(): number {
    return this.active;
  }

  /** Changes the width at runtime, when the user edits the setting. */
  setLimit(limit: number): void {
    if (limit < 1) throw new RangeError('queue limit must be at least 1');
    this.limit = limit;
    this.drain();
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    this.drain();
  }

  private drain(): void {
    while (this.active < this.limit && this.waiting.length > 0) {
      const next = this.waiting.shift();
      next?.();
    }
  }
}
