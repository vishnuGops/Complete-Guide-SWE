import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runProblem, setJudgeConcurrency } from './index.js';
import { PILOTS, makeWorkspaceRoot } from './__fixtures__/pilots.js';

/**
 * The judge under load (ROADMAP P8-2).
 *
 * `queue.test.ts` proves the queue never runs more than its limit, with fake
 * tasks. What it cannot show is the thing the queue exists for: that a burst of
 * real submissions does not turn into a wave of false timeouts because eight
 * interpreters started at once and each of them missed its own deadline.
 *
 * So this goes through `runProblem` - the queued entry point, not the unqueued
 * one every other integration test uses - spawns a real Python for each, and
 * asserts every verdict is the one a single quiet run would have produced.
 *
 * Python only, deliberately. The claim is about the queue rather than about a
 * language, and eight JVMs would make this the slowest file in the suite for no
 * extra coverage.
 */

const BURST = 8;

let workspaceRoot: string;

beforeAll(() => {
  workspaceRoot = makeWorkspaceRoot();
});

afterAll(() => {
  // Back to the default the server starts with, since the queue is module-level
  // state and a later file would inherit whatever this one left.
  setJudgeConcurrency(2);
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
});

describe('a burst of submissions', () => {
  it('answers every one correctly rather than timing some of them out', async () => {
    setJudgeConcurrency(2);
    const pilot = PILOTS.pairSum();

    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: BURST }, () =>
        runProblem({
          meta: pilot.meta,
          language: 'python',
          code: pilot.reference('python'),
          tests: pilot.tests,
          kind: 'submit',
          workspaceRoot,
        }),
      ),
    );
    const elapsed = Date.now() - started;

    // Every one of them, not "most": a single spurious TLE here is the failure
    // mode the queue exists to prevent, and it would look like a flaky problem
    // rather than like an overloaded machine.
    expect(results.map((result) => result.verdict)).toEqual(
      Array.from({ length: BURST }, () => 'AC'),
    );
    expect(results.every((result) => result.passed === result.total)).toBe(true);
    // Nothing fell back to one-process-per-test, which is what a timeout inside
    // a batch would have triggered.
    expect(results.some((result) => result.isolationFallback)).toBe(false);

    console.log(`${String(BURST)} queued python submits at concurrency 2: ${String(elapsed)} ms`);
  }, 180_000);

  it('runs a burst of one-at-a-time without wedging the queue', async () => {
    // Width 1 is a legal setting (the slowest machine the app supports), and a
    // queue that deadlocks at its narrowest is a queue that deadlocks.
    setJudgeConcurrency(1);
    const pilot = PILOTS.pairSum();

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        runProblem({
          meta: pilot.meta,
          language: 'python',
          code: pilot.reference('python'),
          tests: pilot.tests,
          kind: 'run',
          workspaceRoot,
        }),
      ),
    );

    expect(results.map((result) => result.verdict)).toEqual(['AC', 'AC', 'AC']);
  }, 180_000);

  it('a failing solution in the burst fails alone', async () => {
    setJudgeConcurrency(2);
    const pilot = PILOTS.pairSum();
    const wrong = [
      'class Solution:',
      '    def pairSumIndex(self, nums, target):',
      '        return []',
      '',
    ].join('\n');

    const [good, bad, alsoGood] = await Promise.all([
      runProblem({
        meta: pilot.meta,
        language: 'python',
        code: pilot.reference('python'),
        tests: pilot.tests,
        kind: 'submit',
        workspaceRoot,
      }),
      runProblem({
        meta: pilot.meta,
        language: 'python',
        code: wrong,
        tests: pilot.tests,
        kind: 'submit',
        workspaceRoot,
      }),
      runProblem({
        meta: pilot.meta,
        language: 'python',
        code: pilot.reference('python'),
        tests: pilot.tests,
        kind: 'submit',
        workspaceRoot,
      }),
    ]);

    // One workspace per run (P2-5), so a wrong answer beside two right ones
    // cannot leak into either of them.
    expect(good?.verdict).toBe('AC');
    expect(bad?.verdict).toBe('WA');
    expect(alsoGood?.verdict).toBe('AC');
  }, 180_000);
});
