import { describe, expect, it } from 'vitest';
import { RunQueue } from './queue.js';

/** Lets queued continuations run; a microtask flush is not always enough. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('RunQueue', () => {
  it('runs up to the limit concurrently', async () => {
    const queue = new RunQueue(2);
    const gates = [deferred(), deferred(), deferred()];
    let started = 0;

    const tasks = gates.map((gate) =>
      queue.run(async () => {
        started += 1;
        await gate.promise;
      }),
    );

    await tick();
    expect(started).toBe(2);

    gates[0]!.resolve();
    await tick();
    expect(started).toBe(3);

    gates[1]!.resolve();
    gates[2]!.resolve();
    await Promise.all(tasks);
  });

  it('never exceeds the limit under load', async () => {
    const queue = new RunQueue(3);
    let active = 0;
    let peak = 0;

    await Promise.all(
      Array.from({ length: 20 }, () =>
        queue.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 1));
          active -= 1;
        }),
      ),
    );

    expect(peak).toBeLessThanOrEqual(3);
    expect(active).toBe(0);
  });

  it('returns the task result', async () => {
    const queue = new RunQueue(1);
    await expect(queue.run(async () => 42)).resolves.toBe(42);
  });

  it('releases the slot when a task throws, so the queue does not wedge', async () => {
    const queue = new RunQueue(1);
    await expect(
      queue.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(queue.running).toBe(0);
    await expect(queue.run(async () => 'still works')).resolves.toBe('still works');
  });

  it('reports how much work is outstanding', async () => {
    const queue = new RunQueue(1);
    const gate = deferred();
    const first = queue.run(() => gate.promise);
    const second = queue.run(async () => undefined);
    await tick();

    expect(queue.size).toBe(2);
    expect(queue.running).toBe(1);

    gate.resolve();
    await Promise.all([first, second]);
    expect(queue.size).toBe(0);
  });

  it('widening the limit admits waiting work immediately', async () => {
    const queue = new RunQueue(1);
    const gate = deferred();
    let secondStarted = false;

    const first = queue.run(() => gate.promise);
    const second = queue.run(async () => {
      secondStarted = true;
    });

    await tick();
    expect(secondStarted).toBe(false);

    queue.setLimit(2);
    await tick();
    expect(secondStarted).toBe(true);

    gate.resolve();
    await Promise.all([first, second]);
  });

  it('rejects a nonsensical limit rather than deadlocking later', () => {
    expect(() => new RunQueue(0)).toThrow(RangeError);
    expect(() => new RunQueue(1).setLimit(0)).toThrow(RangeError);
  });
});

describe('RunQueue cancellation (P2-17)', () => {
  it('takes an aborted task out of the line without ever running it', async () => {
    const queue = new RunQueue(1);
    const gate = deferred();
    const controller = new AbortController();
    let ran = false;

    const first = queue.run(() => gate.promise);
    const second = queue.run(async () => {
      ran = true;
    }, controller.signal);
    await tick();
    expect(queue.size).toBe(2);

    controller.abort();
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    expect(queue.size).toBe(1);

    gate.resolve();
    await first;
    await tick();
    expect(ran).toBe(false);
    expect(queue.size).toBe(0);
  });

  it('lets the task behind an aborted one take its place', async () => {
    const queue = new RunQueue(1);
    const gate = deferred();
    const controller = new AbortController();
    let thirdStarted = false;

    const first = queue.run(() => gate.promise);
    const second = queue.run(async () => undefined, controller.signal);
    const third = queue.run(async () => {
      thirdStarted = true;
    });
    controller.abort();
    await expect(second).rejects.toMatchObject({ name: 'AbortError' });

    gate.resolve();
    await Promise.all([first, third]);
    expect(thirdStarted).toBe(true);
  });

  it('refuses a task whose signal is already aborted', async () => {
    const queue = new RunQueue(2);
    const controller = new AbortController();
    controller.abort();
    await expect(queue.run(async () => 1, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(queue.running).toBe(0);
  });

  it('does not reach into a task that is already running', async () => {
    const queue = new RunQueue(1);
    const controller = new AbortController();
    const gate = deferred();
    const running = queue.run(async () => {
      await gate.promise;
      return 'finished';
    }, controller.signal);
    await tick();

    controller.abort();
    gate.resolve();
    // Stopping a running task is the task's job; it was given the same signal.
    await expect(running).resolves.toBe('finished');
    expect(queue.running).toBe(0);
  });
});
