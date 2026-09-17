import path from 'node:path';
import {
  DEFAULT_COMPILE_TIMEOUT_MS,
  OUTPUT_CAP_BYTES,
  expectsMutatedArgs,
  expectsReturn,
  timeoutFor,
  worstVerdict,
  type CheckerFn,
  type JsonValue,
  type Language,
  type CompileError,
  type ProblemMeta,
  type RunKind,
  type RunResult,
  type TestCase,
  type TestResult,
  type TestSource,
  type Verdict,
} from '@devpromax/shared';
import { compareValues, loadChecker, type CompareResult } from './comparators.js';
import { javaExecutor } from './executors/java.js';
import { pythonExecutor } from './executors/python.js';
import type { Executor } from './executors/types.js';
import {
  HARNESS_EXIT,
  isFatal,
  type HarnessPayload,
  type HarnessFatalRecord,
  type HarnessRecord,
  type HarnessTestRecord,
} from './protocol.js';
import { RunQueue } from './queue.js';
import { createWorkspace, type Workspace } from './workspace.js';

export { RunQueue } from './queue.js';
export { sweepStaleWorkspaces } from './workspace.js';

const EXECUTORS: Record<Language, Executor> = {
  python: pythonExecutor,
  java: javaExecutor,
};

/**
 * Slack added to the sum of the per-test budgets before the judge's own
 * watchdog fires. The harness enforces each test itself; this outer limit only
 * has to catch a process that is wedged below the harness's reach - a C-level
 * blocking call, say - so it is deliberately generous.
 */
const BATCH_OVERHEAD_MS = 5_000;

export interface JudgeTest {
  source: TestSource;
  test: TestCase;
}

export interface RunProblemOptions {
  meta: ProblemMeta;
  /** Directory the problem lives in; only needed to load `checker.ts`. */
  problemDir?: string;
  language: Language;
  code: string;
  tests: JudgeTest[];
  kind: RunKind;
  /** User-configurable multiplier for slower machines (ROADMAP P3-4). */
  timeoutMultiplier?: number;
  /** Overridden by tests so runs do not touch `data/`. */
  workspaceRoot?: string;
  /**
   * Reveal every hidden test's input and expectation. Off by default: only the
   * first failing hidden test is revealed (ROADMAP P2-6). The validator turns it
   * on, because an author debugging their own problem needs to see everything.
   */
  revealAll?: boolean;
}

const defaultQueue = new RunQueue(2);

export function setJudgeConcurrency(limit: number): void {
  defaultQueue.setLimit(limit);
}

/**
 * Runs one solution against a set of tests and returns a complete verdict.
 *
 * All tests execute in a single process (ROADMAP D3): paying JVM or interpreter
 * startup per test would put a Submit into the tens of seconds. The cost of that
 * choice is that one hanging test would take the whole batch down with it, so
 * the harness reports results incrementally to a file and, when a per-test
 * timeout fires, the judge re-runs only the tests that never got a chance, one
 * process each.
 */
export async function runProblem(options: RunProblemOptions): Promise<RunResult> {
  return defaultQueue.run(() => runProblemUnqueued(options));
}

export async function runProblemUnqueued(options: RunProblemOptions): Promise<RunResult> {
  const { meta, language, code, tests, kind } = options;
  const executor = EXECUTORS[language];
  const multiplier = options.timeoutMultiplier ?? 1;
  const perTestMs = Math.round(timeoutFor(meta.limits, language) * multiplier);
  const started = Date.now();

  const workspace = await createWorkspace(options.workspaceRoot);
  try {
    const prepared = await executor.prepare(
      workspace,
      code,
      Math.round(DEFAULT_COMPILE_TIMEOUT_MS * multiplier),
    );

    if (!prepared.ok) {
      return {
        slug: meta.slug,
        language,
        kind,
        problemVersion: meta.version,
        verdict: 'CE',
        passed: 0,
        total: tests.length,
        totalTimeMs: Date.now() - started,
        compileTimeMs: prepared.timeMs,
        compileErrors: prepared.errors,
        tests: tests.map((entry, index) => ({
          index,
          source: entry.source,
          ...(entry.test.name ? { name: entry.test.name } : {}),
          verdict: 'CE' as const,
          timeMs: 0,
          revealed: entry.source !== 'hidden' || options.revealAll === true,
          stdout: '',
          stderr: '',
        })),
        outputTruncated: false,
        isolationFallback: false,
      };
    }

    const collected = await executeAll(executor, workspace, meta, tests, perTestMs);
    const checker = await resolveChecker(meta, options.problemDir);

    const testResults: TestResult[] = [];
    for (const [index, entry] of tests.entries()) {
      testResults.push(
        await buildTestResult({
          index,
          entry,
          record: collected.fatal ?? collected.byIndex.get(index),
          meta,
          language,
          checker,
          crashStderr: collected.stderr,
        }),
      );
    }

    applyRevealPolicy(testResults, tests, options.revealAll === true);

    const verdict = worstVerdict(testResults.map((t) => t.verdict));
    return {
      slug: meta.slug,
      language,
      kind,
      problemVersion: meta.version,
      verdict,
      passed: testResults.filter((t) => t.verdict === 'AC').length,
      total: testResults.length,
      totalTimeMs: Date.now() - started,
      compileTimeMs: prepared.timeMs,
      compileErrors: [],
      tests: testResults,
      outputTruncated: collected.outputTruncated,
      isolationFallback: collected.isolationFallback,
    };
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// Execution, with the isolation fallback
// ---------------------------------------------------------------------------

interface Collected {
  byIndex: Map<number, HarnessRecord>;
  /** Set when the harness never got as far as running tests; explains all of them. */
  fatal?: HarnessFatalRecord;
  isolationFallback: boolean;
  outputTruncated: boolean;
  /** stderr from the process, used to explain tests that produced no record. */
  stderr: string;
}

function payloadFor(
  workspace: Workspace,
  executor: Executor,
  meta: ProblemMeta,
  tests: readonly JudgeTest[],
  indices: readonly number[],
  perTestMs: number,
): HarnessPayload {
  return {
    mode: meta.mode,
    entry: meta.entry,
    expect: meta.expect,
    timeoutMs: perTestMs,
    solutionPath: workspace.file(executor.solutionFile),
    resultsPath: workspace.file('results.jsonl'),
    tests: indices.map((index) => {
      const test = tests[index]!.test;
      return {
        index,
        args: test.args,
        ...(test.ops ? { ops: test.ops } : {}),
      };
    }),
  };
}

async function executeAll(
  executor: Executor,
  workspace: Workspace,
  meta: ProblemMeta,
  tests: readonly JudgeTest[],
  perTestMs: number,
): Promise<Collected> {
  const byIndex = new Map<number, HarnessRecord>();
  const all = tests.map((_, i) => i);

  const batch = await executor.run(
    workspace,
    payloadFor(workspace, executor, meta, tests, all, perTestMs),
    all.length * perTestMs + BATCH_OVERHEAD_MS,
  );

  let outputTruncated = batch.outputTruncated;
  let stderr = batch.stderr;

  for (const record of batch.records) {
    if (isFatal(record)) {
      // One fatal record explains every test; the caller fans it out.
      return { byIndex, fatal: record, isolationFallback: false, outputTruncated, stderr };
    }
    byIndex.set(record.index, record);
    if (record.outputTruncated) outputTruncated = true;
  }

  const missing = all.filter((i) => !byIndex.has(i));
  if (missing.length === 0) {
    return { byIndex, isolationFallback: false, outputTruncated, stderr };
  }

  // Something stopped the batch early: a per-test timeout the harness reported
  // before bowing out, or a crash that took the process down. Either way the
  // untried tests deserve their own chance, one process each.
  const abandonedByTimeout = batch.exitCode === HARNESS_EXIT.timeout;
  for (const index of missing) {
    const single = await executor.run(
      workspace,
      payloadFor(workspace, executor, meta, tests, [index], perTestMs),
      perTestMs + BATCH_OVERHEAD_MS,
    );
    if (single.outputTruncated) outputTruncated = true;
    if (single.stderr) stderr = single.stderr;

    const record = single.records.find((r) => !isFatal(r) && r.index === index);
    if (record) {
      byIndex.set(index, record);
      continue;
    }
    const fatal = single.records.find(isFatal);
    if (fatal) {
      byIndex.set(index, fatal);
      continue;
    }
    // No record at all: the process died without reporting. If our own watchdog
    // killed it, that is a timeout; otherwise it crashed below the harness.
    byIndex.set(index, {
      index,
      status: single.killed ? 'timeout' : 'error',
      timeMs: single.killed ? perTestMs : single.elapsedMs,
      stdout: '',
      stderr: '',
      outputTruncated: false,
      ...(single.killed
        ? {}
        : {
            error: {
              type: 'ProcessExited',
              message: describeExit(single.exitCode, single.signal, single.stderr),
              traceback: '',
            },
          }),
    });
  }

  return {
    byIndex,
    isolationFallback: abandonedByTimeout || missing.length > 0,
    outputTruncated,
    stderr,
  };
}

function describeExit(code: number | null, signal: NodeJS.Signals | null, stderr: string): string {
  const how = signal ? `killed by ${signal}` : `exited with code ${code ?? 'unknown'}`;
  const detail = stderr.trim().split('\n').slice(-3).join('\n');
  return detail ? `the process ${how}\n${detail}` : `the process ${how} without reporting a result`;
}

// ---------------------------------------------------------------------------
// Turning a harness record into a verdict
// ---------------------------------------------------------------------------

async function resolveChecker(
  meta: ProblemMeta,
  problemDir: string | undefined,
): Promise<CheckerFn | undefined> {
  if (meta.comparator.kind !== 'checker') return undefined;
  if (!problemDir) {
    throw new Error(`${meta.slug} uses a checker comparator but no problem directory was given`);
  }
  return loadChecker(path.join(problemDir, 'checker.ts'));
}

interface BuildArgs {
  index: number;
  entry: JudgeTest;
  record: HarnessRecord | undefined;
  meta: ProblemMeta;
  language: Language;
  checker: CheckerFn | undefined;
  crashStderr: string;
}

async function buildTestResult(args: BuildArgs): Promise<TestResult> {
  const { index, entry, meta, language, checker } = args;
  const base = {
    index,
    source: entry.source,
    ...(entry.test.name ? { name: entry.test.name } : {}),
    revealed: true,
    input: entry.test,
    ...(expectsReturn(meta.expect) && entry.test.expected !== undefined
      ? { expected: entry.test.expected }
      : {}),
    ...(expectsMutatedArgs(meta.expect) && entry.test.expectedMutatedArgs
      ? { expectedMutatedArgs: entry.test.expectedMutatedArgs }
      : {}),
    stdout: '',
    stderr: '',
  };

  const record = args.record;
  if (!record) {
    return {
      ...base,
      verdict: 'RE',
      timeMs: 0,
      message: args.crashStderr.trim() || 'the judge received no result for this test',
    };
  }

  if (isFatal(record)) {
    return {
      ...base,
      verdict: record.kind === 'compile' ? 'CE' : 'RE',
      timeMs: 0,
      message: record.message,
      stderr: record.traceback,
    };
  }

  if (record.status === 'timeout') {
    return { ...base, verdict: 'TLE', timeMs: record.timeMs, message: 'exceeded the time limit' };
  }

  if (record.status === 'error') {
    return {
      ...base,
      verdict: runtimeVerdict(language, record),
      timeMs: record.timeMs,
      stdout: record.stdout,
      stderr: record.error?.traceback ?? record.stderr,
      message: record.error
        ? `${record.error.type}: ${record.error.message}`
        : 'the solution raised',
    };
  }

  // A custom case is input the user typed, with no expected output to compare
  // against: Run with custom input answers "what does my code do with this",
  // not "is my code correct". Reaching the end of it without raising is the
  // whole result, so the value is reported and the verdict stays AC.
  if (entry.source === 'custom') {
    return {
      ...base,
      verdict: 'AC',
      timeMs: record.timeMs,
      stdout: record.stdout,
      stderr: record.stderr,
      ...(record.returned !== undefined ? { actual: record.returned } : {}),
      ...(record.mutatedArgs ? { actualMutatedArgs: record.mutatedArgs } : {}),
    };
  }

  const comparison = await judgeOutputs(record, entry.test, meta, checker);
  return {
    ...base,
    verdict: comparison.pass ? 'AC' : 'WA',
    timeMs: record.timeMs,
    stdout: record.stdout,
    stderr: record.stderr,
    ...(record.returned !== undefined ? { actual: record.returned } : {}),
    ...(record.mutatedArgs ? { actualMutatedArgs: record.mutatedArgs } : {}),
    ...(comparison.message ? { message: comparison.message } : {}),
  };
}

/**
 * Java is given `-Xmx`, so an OutOfMemoryError is an honest memory verdict.
 * CPython has no comparable cap here, so a Python MemoryError stays RE rather
 * than claiming a limit the judge does not actually enforce (see D3, P0-7).
 */
function runtimeVerdict(language: Language, record: HarnessTestRecord): Verdict {
  if (language === 'java' && record.error?.type === 'OutOfMemoryError') return 'MLE';
  if (language === 'java' && record.error?.type === 'StackOverflowError') return 'RE';
  return 'RE';
}

async function judgeOutputs(
  record: HarnessTestRecord,
  test: TestCase,
  meta: ProblemMeta,
  checker: CheckerFn | undefined,
): Promise<CompareResult> {
  const options = {
    comparator: meta.comparator,
    test,
    ...(checker ? { checker } : {}),
  };

  if (expectsReturn(meta.expect)) {
    const result = await compareValues(test.expected, record.returned, options);
    if (!result.pass) return result;
  }

  if (expectsMutatedArgs(meta.expect)) {
    const expectedArgs = test.expectedMutatedArgs ?? [];
    const actualArgs = new Map((record.mutatedArgs ?? []).map((m) => [m.index, m.value]));
    for (const want of expectedArgs) {
      if (!actualArgs.has(want.index)) {
        return {
          pass: false,
          message: `argument ${want.index} was not reported back by the harness`,
        };
      }
      const result = await compareValues(
        want.value,
        actualArgs.get(want.index) as JsonValue,
        options,
      );
      if (!result.pass) {
        return {
          pass: false,
          message: `argument ${want.index} was not left as expected: ${result.message ?? 'mismatch'}`,
        };
      }
    }
  }

  return { pass: true };
}

// ---------------------------------------------------------------------------
// Hidden-test reveal policy (ROADMAP P2-6)
// ---------------------------------------------------------------------------

/**
 * Samples and custom cases are always fully visible. Hidden tests are not, with
 * one exception: the first one that fails is revealed, because a Submit that
 * only says "wrong answer on test 7" gives the user nothing to work with.
 */
function applyRevealPolicy(
  results: TestResult[],
  tests: readonly JudgeTest[],
  revealAll: boolean,
): void {
  if (revealAll) return;

  let firstFailureRevealed = false;
  for (const [index, result] of results.entries()) {
    if (tests[index]?.source !== 'hidden') continue;

    const failed = result.verdict !== 'AC';
    if (failed && !firstFailureRevealed) {
      firstFailureRevealed = true;
      continue;
    }

    result.revealed = false;
    delete result.input;
    delete result.expected;
    delete result.actual;
    delete result.expectedMutatedArgs;
    delete result.actualMutatedArgs;
    result.stdout = '';
    result.stderr = '';
    if (result.verdict === 'WA') delete result.message;
  }
}

export { OUTPUT_CAP_BYTES };

/**
 * Compiles (Java) or parses (Python) a source file without running anything.
 *
 * Used by the validator to prove a starter is a legal program before a user is
 * ever handed it (ROADMAP P2-7): a starter that does not compile turns someone's
 * first Run into a compile error that says nothing about the problem.
 */
export async function checkCompiles(
  language: Language,
  code: string,
  options: { workspaceRoot?: string; timeoutMultiplier?: number } = {},
): Promise<{ ok: boolean; errors: CompileError[]; timeMs: number }> {
  const executor = EXECUTORS[language];
  const workspace = await createWorkspace(options.workspaceRoot);
  try {
    const prepared = await executor.prepare(
      workspace,
      code,
      Math.round(DEFAULT_COMPILE_TIMEOUT_MS * (options.timeoutMultiplier ?? 1)),
    );
    return prepared.ok
      ? { ok: true, errors: [], timeMs: prepared.timeMs }
      : { ok: false, errors: prepared.errors, timeMs: prepared.timeMs };
  } finally {
    await workspace.dispose();
  }
}
