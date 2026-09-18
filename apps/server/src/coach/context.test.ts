import { describe, expect, it } from 'vitest';
import { problemMetaSchema, type RunResult, type TestResult } from '@devpromax/shared';
import { buildContext, CONTEXT_BUDGET_CHARS, type ContextInput } from './context.js';

/**
 * The context builder (ROADMAP P5-2, D13).
 *
 * Two things are worth testing here and they pull in opposite directions: that
 * everything D13 promises the coach actually reaches it, and that a pathological
 * problem - a hundred-thousand-integer hidden test, a novel-length editorial -
 * cannot push the code out of the request. The code is the one input the whole
 * answer is about, so the tests below mostly exist to prove it survives.
 */

/**
 * Parsed rather than cast, so the fixture is a real `ProblemMeta` - defaults
 * applied, every required field present. A cast would let this file keep
 * compiling after the schema grew a field the context builder should be
 * rendering, which is exactly the drift these tests exist to catch.
 */
const META = problemMetaSchema.parse({
  id: 'pair-sum-index',
  slug: 'pair-sum-index',
  title: 'Pair Sum Index',
  version: 1,
  topic: 'arrays',
  patterns: ['hash map', 'complement lookup'],
  tier: 'Easy',
  rating: 2,
  order: 0,
  mode: 'function',
  entry: 'pairSumIndex',
  expect: 'return',
  comparator: 'exact',
  limits: { python: { timeMs: 4000 }, java: { timeMs: 2000 } },
  targetComplexity: { time: 'O(n)', space: 'O(n)' },
});

const CODE = 'class Solution:\n    def pairSumIndex(self, nums, target):\n        return [0, 0]';

function input(overrides: Partial<ContextInput> = {}): ContextInput {
  return {
    meta: META,
    statement: 'Find the two indices that sum to the target.',
    editorial: 'Walk once, keeping a map of value to index.',
    language: 'python',
    code: CODE,
    ...overrides,
  };
}

function test(overrides: Partial<TestResult> = {}): TestResult {
  return {
    index: 0,
    source: 'sample',
    verdict: 'WA',
    timeMs: 3,
    revealed: true,
    stdout: '',
    stderr: '',
    ...overrides,
  };
}

function run(overrides: Partial<RunResult> = {}): RunResult {
  return {
    slug: 'pair-sum-index',
    language: 'python',
    kind: 'run',
    problemVersion: 1,
    verdict: 'WA',
    passed: 1,
    total: 3,
    totalTimeMs: 120,
    compileErrors: [],
    tests: [],
    outputTruncated: false,
    isolationFallback: false,
    ...overrides,
  };
}

describe('buildContext', () => {
  it('includes everything D13 promises the coach', () => {
    const context = buildContext(
      input({
        lastRun: run({ tests: [test({ expected: [0, 1], actual: [0, 0] })] }),
        revealedHints: ['Think about what you have already seen.'],
        solved: false,
      }),
    );

    expect(context).toContain('Pair Sum Index');
    expect(context).toContain('Target complexity: time O(n), space O(n)');
    expect(context).toContain('Find the two indices');
    expect(context).toContain(CODE);
    expect(context).toContain('Wrong Answer');
    expect(context).toContain('Think about what you have already seen.');
    expect(context).toContain('Walk once, keeping a map');
  });

  it('marks the authored next hint secret, and places it above the request flags (P7-1)', () => {
    const context = buildContext(
      input({
        revealedHints: ['Think about what you have already seen.'],
        nextAuthoredHint: 'A map from value to index answers the question in one step.',
      }),
    );

    expect(context).toMatch(/Author's next hint \(SECRET[^)]*\)/);
    expect(context).toMatch(/never hand it over/i);
    expect(context).toContain('A map from value to index answers the question in one step.');
    // Read rungs, then the one ahead: the coach is told what not to repeat
    // before it is told where to point.
    expect(context.indexOf('Think about what you have already seen.')).toBeLessThan(
      context.indexOf("Author's next hint"),
    );
  });

  it('leaves the section out when there is no rung ahead (P7-1)', () => {
    expect(buildContext(input())).not.toContain("Author's next hint");
  });

  it('marks the editorial secret, because the coach must not quote it', () => {
    const context = buildContext(input());
    expect(context).toMatch(/Editorial approach \(SECRET[^)]*\)/);
    expect(context).toMatch(/never quote or mention it/i);
  });

  it('says the code has not been run rather than leaving the coach to assume', () => {
    const context = buildContext(input({ lastRun: undefined }));
    expect(context).toMatch(/not run this code yet/i);
    expect(context).toMatch(/Do not assume it passes/i);
  });

  it('states the two facts that gate the solution rung separately', () => {
    const context = buildContext(input({ solved: true, requestFullSolution: false }));
    expect(context).toContain('Problem already solved by this user: yes');
    expect(context).toContain('User explicitly asked for the full solution: no');
  });

  it('notes when a failing test is hidden instead of showing nothing', () => {
    const context = buildContext(
      input({
        lastRun: run({
          tests: [test({ source: 'hidden', revealed: false, index: 7 })],
        }),
      }),
    );

    expect(context).toMatch(/hidden test; input and expected output not revealed/);
  });

  it('shows compile errors instead of test detail, which means nothing if it did not build', () => {
    const context = buildContext(
      input({
        lastRun: run({
          verdict: 'CE',
          passed: 0,
          compileErrors: [
            { line: 3, column: 9, message: 'cannot find symbol: nusm', severity: 'error' },
          ],
          tests: [test({ verdict: 'WA', expected: 'never rendered' })],
        }),
      }),
    );

    expect(context).toContain('cannot find symbol');
    expect(context).not.toContain('never rendered');
  });

  it('caps how many failures it shows, and says how many there were', () => {
    const tests = Array.from({ length: 12 }, (_, i) =>
      test({ index: i, expected: `expected-${i}`, actual: `actual-${i}` }),
    );
    const context = buildContext(input({ lastRun: run({ tests, total: 12, passed: 0 }) }));

    expect(context).toContain('Failing tests (12,');
    expect(context).toContain('expected-0');
    expect(context).not.toContain('expected-11');
  });

  it('caps a single enormous revealed value', () => {
    const huge = Array.from({ length: 50_000 }, (_, i) => i);
    const context = buildContext(
      input({ lastRun: run({ tests: [test({ expected: huge, actual: [] })] }) }),
    );

    expect(context).toMatch(/value truncated/);
    expect(context.length).toBeLessThan(CONTEXT_BUDGET_CHARS);
  });
});

/**
 * Pressure has to come from the code.
 *
 * Every other section has a cap of its own, so a novel-length statement is 8k
 * by the time the budget looks at it and the drop path is never reached. The
 * code is the one input deliberately left uncapped, which makes "a very long
 * solution" the real case in which something has to give.
 */
function longCode(chars: number): string {
  return `${CODE}\n# ${'y'.repeat(chars)}`;
}

function priorAttempt(summary: string) {
  return {
    at: '2026-09-16T00:00:00.000Z',
    feedback: {
      summary,
      scores: {
        correctness: 2,
        timeComplexity: 2,
        spaceComplexity: 3,
        edgeCases: 2,
        readability: 3,
      },
      feedbackMarkdown: 'earlier',
      nextHintLevel: 'concept' as const,
      mastered: false,
    },
  };
}

describe('the budget', () => {
  it('drops both droppable sections when nothing less will do, and keeps the code', () => {
    const context = buildContext(
      input({
        code: longCode(CONTEXT_BUDGET_CHARS * 2),
        editorial: 'SECRET-EDITORIAL-BODY',
        priorAttempts: [priorAttempt('PRIOR-ATTEMPT-SUMMARY')],
      }),
    );

    expect(context).not.toContain('PRIOR-ATTEMPT-SUMMARY');
    expect(context).not.toContain('SECRET-EDITORIAL-BODY');
    expect(context).toContain(CODE);
  });

  it('keeps the editorial when dropping the prior attempts is enough', () => {
    // Sized so exactly one section has to go: the attempts are ~20k, and the
    // rest without them comes in under the budget.
    const context = buildContext(
      input({
        code: longCode(CONTEXT_BUDGET_CHARS - 10_000),
        editorial: 'SECRET-EDITORIAL-BODY',
        priorAttempts: [priorAttempt('PRIOR-ATTEMPT-SUMMARY'.repeat(1_000))],
      }),
    );

    expect(context).not.toContain('PRIOR-ATTEMPT-SUMMARY');
    expect(context).toContain('SECRET-EDITORIAL-BODY');
    expect(context).toContain(CODE);
  });

  it('never truncates the code, even when the code alone blows the budget', () => {
    // A review of half a function is worse than no review: it is confidently
    // wrong about what is missing. Going over budget is the better failure.
    const enormous = `# ${'y'.repeat(CONTEXT_BUDGET_CHARS * 2)}\n${CODE}`;
    const context = buildContext(input({ code: enormous }));

    expect(context).toContain(CODE);
    expect(context).toContain('y'.repeat(1000));
  });

  it('caps the statement rather than letting one problem eat the request', () => {
    const context = buildContext(input({ statement: 'z'.repeat(CONTEXT_BUDGET_CHARS) }));
    expect(context).toMatch(/statement truncated/);
    expect(context).toContain(CODE);
  });
});
