import { abortReason } from './process.js';

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

  /**
   * Runs `task` once a slot is free.
   *
   * An aborted `signal` takes a task that is still waiting out of the line
   * (ROADMAP P2-17): a Run whose tab was closed would otherwise wait its turn,
   * start a JVM nobody is listening to, and hold the slot the next Run needed.
   * A task already running is the task's to stop - it gets the same signal.
   */
  async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal);
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        const at = this.waiting.indexOf(admit);
        if (at !== -1) this.waiting.splice(at, 1);
        reject(abortReason(signal as AbortSignal));
      };
      const admit = (): void => {
        signal?.removeEventListener('abort', onAbort);
        this.active += 1;
        resolve();
      };
      this.waiting.push(admit);
      signal?.addEventListener('abort', onAbort, { once: true });
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
