import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RunRequest, RunResult, TestResult, Verdict } from '@devpromax/shared';
import { paths } from '../config.js';
import { createDatabase, IN_MEMORY, type Repositories } from '../db/index.js';
import type { RunProblemOptions } from '../judge/index.js';
import { CustomTestError, ProblemNotFoundError, executeRun } from './runService.js';

/**
 * Run and Submit semantics, driven with a stand-in judge.
 *
 * What is under test here is which tests each kind runs and what each kind is
 * allowed to write down - not whether the judge judges correctly, which the
 * judge integration tests answer by spawning real interpreters.
 */

let repos: Repositories;
/** The options the service handed the judge on the last call. */
let seen: RunProblemOptions | undefined;

const PAIR_SUM = 'pair-sum-index';
const MIN_STACK = 'min-value-stack';

function fakeJudge(verdict: Verdict = 'AC', timings: number[] = []) {
  return async (options: RunProblemOptions): Promise<RunResult> => {
    seen = options;
    const tests: TestResult[] = options.tests.map((entry, index) => ({
      index,
      source: entry.source,
      verdict: index === 0 ? verdict : 'AC',
      timeMs: timings[index] ?? 1,
      revealed: true,
      stdout: '',
      stderr: '',
    }));
    return {
      slug: options.meta.slug,
      language: options.language,
      kind: options.kind,
      problemVersion: options.meta.version,
      verdict,
      passed: tests.filter((t) => t.verdict === 'AC').length,
      total: tests.length,
      totalTimeMs: 10,
      compileErrors: [],
      tests,
      outputTruncated: false,
      isolationFallback: false,
    };
  };
}

function request(over: Partial<RunRequest> = {}): RunRequest {
  return {
    slug: PAIR_SUM,
    language: 'python',
    code: 'class Solution: pass',
    kind: 'run',
    ...over,
  };
}

const run = async (over: Partial<RunRequest> = {}, judge = fakeJudge()) =>
  executeRun(request(over), { repos, judge, now: '2026-09-17T09:00:00.000Z' });

beforeEach(() => {
  repos = createDatabase({ file: IN_MEMORY });
  seen = undefined;
});

afterEach(() => {
  repos.close();
});

describe('which tests each kind runs', () => {
  it('Run uses the problem samples and nothing hidden', async () => {
    await run({ kind: 'run' });

    const sources = new Set(seen?.tests.map((t) => t.source));
    expect(sources).toEqual(new Set(['sample']));
    expect(seen?.tests.length).toBeGreaterThanOrEqual(3);
  });

  it('Run adds the user cases, tagged so the judge does not grade them', async () => {
    await run({ kind: 'run', customTests: [{ args: [[9, 1], 10] }] });

    const custom = seen?.tests.filter((t) => t.source === 'custom') ?? [];
    expect(custom).toHaveLength(1);
    expect(custom[0]?.test.args).toEqual([[9, 1], 10]);
  });

  it('Submit uses samples and every hidden test', async () => {
    await run({ kind: 'submit' });

    const sources = seen?.tests.map((t) => t.source) ?? [];
    expect(sources).toContain('sample');
    expect(sources.filter((s) => s === 'hidden').length).toBeGreaterThanOrEqual(10);
  });

  it('Submit ignores custom cases rather than grading against them', async () => {
    await run({ kind: 'submit', customTests: [{ args: [[9, 1], 10] }] });

    expect(seen?.tests.some((t) => t.source === 'custom')).toBe(false);
  });

  it('passes the judge timeout multiplier from settings', async () => {
    repos.settings.update({ judge: { timeoutMultiplier: 2.5 } });
    await run();

    expect(seen?.timeoutMultiplier).toBe(2.5);
  });

  it('gives the judge the problem directory, so a checker can be loaded', async () => {
    await run();
    expect(seen?.problemDir).toContain(PAIR_SUM);
  });
});

describe('custom case validation', () => {
  it('rejects a case with the wrong number of arguments', async () => {
    await expect(run({ customTests: [{ args: [[1, 2]] }] })).rejects.toBeInstanceOf(
      CustomTestError,
    );
  });

  it('says which case was wrong', async () => {
    const error = await run({
      customTests: [{ args: [[1, 2], 3] }, { args: [[1, 2]] }],
    }).catch((e: unknown) => e as CustomTestError);

    expect(error).toBeInstanceOf(CustomTestError);
    expect((error as CustomTestError).issues[0]?.case).toBe(1);
  });

  it('refuses a case that brought its own expected output', async () => {
    await expect(
      run({ customTests: [{ args: [[1, 2], 3], expected: [0, 1] }] }),
    ).rejects.toBeInstanceOf(CustomTestError);
  });

  it('rejects an unknown method on an operations problem', async () => {
    await expect(
      run({ slug: MIN_STACK, customTests: [{ args: [], ops: [{ method: 'nope', args: [] }] }] }),
    ).rejects.toBeInstanceOf(CustomTestError);
  });

  it('accepts a well-formed operations case', async () => {
    await run({
      slug: MIN_STACK,
      customTests: [{ args: [], ops: [{ method: 'push', args: [1] }] }],
    });

    expect(seen?.tests.some((t) => t.source === 'custom')).toBe(true);
  });

  it('writes nothing when a case is rejected', async () => {
    await run({ customTests: [{ args: [[1, 2]] }] }).catch(() => undefined);

    expect(repos.progress.list()).toEqual([]);
    expect(repos.events.list()).toEqual([]);
  });
});

describe('what a Run records', () => {
  it('marks the problem in progress without recording a submission', async () => {
    await run({ kind: 'run' });

    expect(repos.progress.get(PAIR_SUM, 'python')?.status).toBe('in_progress');
    expect(repos.submissions.list()).toEqual([]);
  });

  it('does not count as an attempt', async () => {
    await run({ kind: 'run' });
    await run({ kind: 'run' });

    expect(repos.progress.get(PAIR_SUM, 'python')?.attempts).toBe(0);
  });

  it('logs the activity for the streak calendar', async () => {
    await run({ kind: 'run' });

    const [event] = repos.events.list();
    expect(event).toMatchObject({ type: 'run', slug: PAIR_SUM, language: 'python' });
  });

  it('never solves a problem, however the run went', async () => {
    await run({ kind: 'run' }, fakeJudge('AC'));

    expect(repos.progress.get(PAIR_SUM, 'python')?.status).toBe('in_progress');
  });
});

describe('what a Submit records', () => {
  it('stores the code, verdict and the problem version it faced', async () => {
    await run({ kind: 'submit', code: 'my solution' }, fakeJudge('AC'));

    const [submission] = repos.submissions.list();
    expect(submission).toMatchObject({
      slug: PAIR_SUM,
      language: 'python',
      code: 'my solution',
      verdict: 'AC',
    });
    expect(submission?.problemVersion).toBeGreaterThanOrEqual(1);
  });

  it('records the slowest test, not the total', async () => {
    await run({ kind: 'submit' }, fakeJudge('AC', [3, 17, 5]));

    expect(repos.submissions.list()[0]?.timeMs).toBe(17);
  });

  it('solves the problem on an accepted submission', async () => {
    await run({ kind: 'submit' }, fakeJudge('AC'));

    const progress = repos.progress.get(PAIR_SUM, 'python');
    expect(progress?.status).toBe('solved');
    expect(progress?.solvedAt).toBe('2026-09-17T09:00:00.000Z');
    expect(progress?.attempts).toBe(1);
  });

  it('leaves a rejected submission in progress', async () => {
    await run({ kind: 'submit' }, fakeJudge('WA'));

    expect(repos.progress.get(PAIR_SUM, 'python')?.status).toBe('in_progress');
    expect(repos.submissions.list()[0]?.verdict).toBe('WA');
  });

  // The regression the roadmap names, checked through the whole path rather
  // than only in the status engine.
  it('never demotes a solved problem on a later failure', async () => {
    await run({ kind: 'submit' }, fakeJudge('AC'));
    await run({ kind: 'submit' }, fakeJudge('TLE'));

    const progress = repos.progress.get(PAIR_SUM, 'python');
    expect(progress?.status).toBe('solved');
    expect(progress?.attempts).toBe(2);
  });

  it('keeps a compile error as an attempt', async () => {
    await run({ kind: 'submit' }, fakeJudge('CE'));

    expect(repos.progress.get(PAIR_SUM, 'python')?.attempts).toBe(1);
    expect(repos.submissions.list()[0]?.verdict).toBe('CE');
  });

  it('tracks each language separately', async () => {
    await run({ kind: 'submit', language: 'python' }, fakeJudge('AC'));
    await run({ kind: 'submit', language: 'java' }, fakeJudge('WA'));

    expect(repos.progress.get(PAIR_SUM, 'python')?.status).toBe('solved');
    expect(repos.progress.get(PAIR_SUM, 'java')?.status).toBe('in_progress');
  });

  it('logs the verdict with the activity', async () => {
    await run({ kind: 'submit' }, fakeJudge('WA'));

    expect(repos.events.list()[0]).toMatchObject({
      type: 'submit',
      payload: { verdict: 'WA' },
    });
  });
});

describe('unknown problems', () => {
  it('reports a missing slug as its own kind of failure', async () => {
    await expect(run({ slug: 'no-such-problem' })).rejects.toBeInstanceOf(ProblemNotFoundError);
  });

  it('writes nothing for a problem that does not exist', async () => {
    await run({ slug: 'no-such-problem' }).catch(() => undefined);
    expect(repos.events.list()).toEqual([]);
  });
});

describe('a Run leaves the hidden tests unread (P2-18)', () => {
  let root: string;

  beforeEach(() => {
    // A copy of a real problem whose hidden pool would fail validation: a
    // Submit has to read it and says so, a Run must not even look.
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'devpromax-run-hidden-'));
    const target = path.join(root, 'arrays', PAIR_SUM);
    fs.cpSync(path.join(paths.problems, 'arrays', PAIR_SUM), target, { recursive: true });
    const testsFile = path.join(target, 'tests.json');
    const tests = JSON.parse(fs.readFileSync(testsFile, 'utf8')) as { hidden: unknown[] };
    tests.hidden = [{ args: 'not a list of arguments' }];
    fs.writeFileSync(testsFile, JSON.stringify(tests));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('runs the samples of a problem whose hidden tests do not parse', async () => {
    await executeRun(request({ kind: 'run' }), { repos, judge: fakeJudge(), problemsRoot: root });
    expect(seen?.tests.every((t) => t.source === 'sample')).toBe(true);
  });

  it('while a Submit, which needs them, still refuses', async () => {
    await expect(
      executeRun(request({ kind: 'submit' }), { repos, judge: fakeJudge(), problemsRoot: root }),
    ).rejects.toThrow(/could not be read/);
  });
});

describe('a cancelled run (P2-17)', () => {
  it('hands the judge the signal', async () => {
    const controller = new AbortController();
    await executeRun(request(), { repos, judge: fakeJudge(), signal: controller.signal });
    expect(seen?.signal).toBe(controller.signal);
  });

  it('records nothing when the client left while the judge was running', async () => {
    const controller = new AbortController();
    const judge = async (options: RunProblemOptions): Promise<RunResult> => {
      const result = await fakeJudge('AC')(options);
      // The verdict came back, but the tab that asked for it has gone.
      controller.abort();
      return result;
    };

    const error = await executeRun(request({ kind: 'submit' }), {
      repos,
      judge,
      signal: controller.signal,
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({ name: 'AbortError' });
    expect(repos.submissions.list()).toEqual([]);
    expect(repos.progress.list()).toEqual([]);
    expect(repos.events.list()).toEqual([]);
  });
});
