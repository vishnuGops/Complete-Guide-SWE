import { describe, expect, it } from 'vitest';
import type { RunResult, TestResult, Verdict } from '@devpromax/shared';
import { judgeHeadline, judgeSummary } from './judgeSummary.js';

/**
 * The no-key fallback (ROADMAP P5-6).
 *
 * What these tests are really pinning is the restraint: this summary must say
 * only what the result proves. A local heuristic that guessed at causes would
 * read exactly like coaching, and the user would have no way to tell which one
 * they were getting.
 */

function test(overrides: Partial<TestResult> = {}): TestResult {
  return {
    index: 0,
    source: 'sample',
    verdict: 'WA',
    timeMs: 5,
    revealed: true,
    stdout: '',
    stderr: '',
    ...overrides,
  };
}

function result(verdict: Verdict, overrides: Partial<RunResult> = {}): RunResult {
  return {
    slug: 'pair-sum-index',
    language: 'python',
    kind: 'submit',
    problemVersion: 1,
    verdict,
    passed: 0,
    total: 3,
    totalTimeMs: 40,
    compileErrors: [],
    tests: [],
    outputTruncated: false,
    isolationFallback: false,
    ...overrides,
  };
}

describe('judgeSummary', () => {
  it('says nothing at all about an ordinary pass', () => {
    // Silence is correct: there is nothing the judge can add, and inventing
    // something would be the local heuristic pretending to be a coach.
    const ac = result('AC', { verdict: 'AC', passed: 3, tests: [test({ verdict: 'AC' })] });
    expect(judgeSummary(ac, 4000)).toEqual([]);
  });

  it('warns about a pass that nearly timed out', () => {
    const ac = result('AC', {
      passed: 3,
      tests: [test({ verdict: 'AC', timeMs: 3200 })],
    });
    const points = judgeSummary(ac, 4000);

    expect(points[0]).toMatch(/3200 ms/);
    expect(points[0]).toMatch(/larger input/i);
  });

  it('points at the first compile error and stops there', () => {
    const ce = result('CE', {
      compileErrors: [{ line: 7, column: 3, message: 'cannot find symbol', severity: 'error' }],
      tests: [test()],
    });
    const points = judgeSummary(ce, 2000);

    expect(points).toHaveLength(1);
    expect(points[0]).toContain('line 7');
  });

  it('names a timeout as a complexity problem, not a slow line', () => {
    const tle = result('TLE', { tests: [test({ verdict: 'TLE', timeMs: 4000 })] });
    expect(judgeSummary(tle, 4000)[0]).toMatch(/complexity/i);
  });

  it('counts the disagreeing tests', () => {
    const wa = result('WA', {
      passed: 1,
      total: 3,
      tests: [test({ expected: 1, actual: 2 }), test({ index: 1, expected: 3, actual: 4 })],
    });
    expect(judgeSummary(wa, 4000)[0]).toContain('2 of 3');
  });

  it('notices when every visible failure returned the same value', () => {
    const wa = result('WA', {
      total: 3,
      tests: [
        test({ input: { args: [[1, 2], 3] }, expected: [0, 1], actual: [] }),
        test({ index: 1, input: { args: [[4, 5], 9] }, expected: [0, 1], actual: [] }),
      ],
    });
    expect(judgeSummary(wa, 4000).join(' ')).toMatch(/same value/);
  });

  it('says nothing about a shape it cannot prove', () => {
    // Two failures returning different values is not a pattern; a first draft
    // also guessed at "all inputs are minimal", which was dropped rather than
    // tuned - see the note in describeShape.
    const wa = result('WA', {
      total: 3,
      tests: [
        test({ input: { args: [[], 0] }, expected: [], actual: [1] }),
        test({ index: 1, input: { args: [[7], 7] }, expected: [], actual: [2] }),
      ],
    });
    const points = judgeSummary(wa, 4000);

    expect(points).toHaveLength(1);
    expect(points[0]).toContain('2 of 3');
  });

  it('says nothing about a pattern it cannot see', () => {
    // Hidden tests carry no values, so there is no shape to report.
    const wa = result('WA', {
      total: 3,
      tests: [
        test({ source: 'hidden', revealed: false }),
        test({ source: 'hidden', revealed: false, index: 1 }),
      ],
    });
    const points = judgeSummary(wa, 4000);

    expect(points).toHaveLength(1);
    expect(points[0]).toContain('2 of 3');
  });

  it('reports a runtime error’s first line only', () => {
    const re = result('RE', {
      tests: [test({ verdict: 'RE', message: 'IndexError: list index out of range\n  at line 4' })],
    });
    expect(judgeSummary(re, 4000)[0]).toBe('It threw: IndexError: list index out of range');
  });
});

describe('judgeHeadline', () => {
  it('names the verdict and the counts', () => {
    expect(judgeHeadline(result('WA', { passed: 1, total: 3 }))).toBe(
      'Wrong Answer — 1/3 tests passed.',
    );
  });
});
