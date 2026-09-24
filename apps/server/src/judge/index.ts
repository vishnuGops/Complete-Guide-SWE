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
import { paths } from '../config.js';
import { logger } from '../logger.js';
import { compareValues, loadChecker, type CompareResult } from './comparators.js';
import { EXECUTOR_KIND, type ExecutorKind } from './executors/commands.js';
import { dockerLauncher } from './executors/docker.js';
import { createJavaExecutor, javaExecutor } from './executors/java.js';
import { createPythonExecutor, pythonExecutor } from './executors/python.js';
import type { Executor, HarnessRun, PrepareOptions } from './executors/types.js';
import { throwIfAborted } from './process.js';
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
export { killLiveChildren, isAbortError } from './process.js';
export { JudgeUnavailableError } from './executors/launcher.js';
export { EXECUTOR_KIND, type ExecutorKind } from './executors/commands.js';
export { sweepStaleWorkspaces } from './workspace.js';

/**
 * The executors, by where they run (ROADMAP P9-2). The same two languages
 * either way; only the launcher underneath differs, which is the whole reason
 * the executor interface was kept this small.
 */
const EXECUTORS: Record<ExecutorKind, Record<Language, Executor>> = {
  local: { python: pythonExecutor, java: javaExecutor },
  docker: {
    python: createPythonExecutor(dockerLauncher),
    java: createJavaExecutor(dockerLauncher),
  },
};

function executorFor(language: Language, kind: ExecutorKind = EXECUTOR_KIND): Executor {
  return EXECUTORS[kind][language];
}

/**
 * How long past a per-test budget the judge waits before calling it a stall.
 *
 * Generous, because the thing being measured is "a result appeared", and the
 * first result of a run is behind interpreter start-up and module import.
 */
const STALL_SLACK_MS = 3_000;

/**
 * Slack added to the sum of the per-test budgets before the judge's own
 * wall-clock watchdog fires. The harness enforces each test itself; this outer
 * limit only has to catch a process that is wedged below the harness's reach -
 * a C-level blocking call, say - so it is deliberately generous.
 */
const BATCH_OVERHEAD_MS = 5_000;

/**
 * Build products that outlive a run - the compiled Java harness (ROADMAP
 * P2-18) - kept beside the workspace root rather than in it, because the
 * startup sweep deletes whatever it finds there. `data/judge` gives
 * `data/devpromax-judge-cache`; a test's temporary root gives one in the temp
 * directory, shared by every test run on the machine, which is the point.
 */
export function judgeCacheDir(workspaceRoot: string = paths.judgeWorkspaces): string {
  return path.join(path.dirname(path.resolve(workspaceRoot)), 'devpromax-judge-cache');
}

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
   * Where the code runs. Defaults to `DEVPROMAX_EXECUTOR`; the Docker suite
   * sets it so one process can exercise both.
   */
  executor?: ExecutorKind;
  /**
   * Reveal every hidden test's input and expectation. Off by default: only the
   * first failing hidden test is revealed (ROADMAP P2-6). The validator turns it
   * on, because an author debugging their own problem needs to see everything.
   */
  revealAll?: boolean;
  /**
   * Cancels the run (ROADMAP P2-17): taken out of the queue if it is still
   * waiting, its processes killed if not. A cancelled run rejects with an
   * `AbortError` and produces no result, so there is nothing to record.
   */
  signal?: AbortSignal;
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
 * the harness reports results incrementally to a file and, when a test times
 * out or crashes the process, the judge starts a new batch at the test after
 * it (ROADMAP P2-17).
 */
export async function runProblem(options: RunProblemOptions): Promise<RunResult> {
  return defaultQueue.run(() => runProblemUnqueued(options), options.signal);
}

export async function runProblemUnqueued(options: RunProblemOptions): Promise<RunResult> {
  const { meta, language, code, tests, signal } = options;
  throwIfAborted(signal);

  const executor = executorFor(language, options.executor);
  const multiplier = options.timeoutMultiplier ?? 1;
  const perTestMs = Math.round(timeoutFor(meta.limits, language) * multiplier);
  const started = Date.now();
  const root = options.workspaceRoot ?? paths.judgeWorkspaces;

  const workspace = await createWorkspace(root);
  try {
    const prepared = await executor.prepare(
      workspace,
      code,
      prepareOptions(root, multiplier, signal),
    );
    throwIfAborted(signal);

    if (!prepared.ok) {
      return compileErrorResult(options, prepared.errors, prepared.timeMs, started);
    }

    const collected = await executeAll({
      executor,
      workspace,
      meta,
      tests,
      perTestMs,
      signal,
      shared: prepared.shared,
    });

    // Python's syntax errors arrive here rather than from `prepare`: the
    // harness finds them as it imports the solution (ROADMAP P2-18).
    if (collected.fatal?.kind === 'compile') {
      const { line, column, message } = collected.fatal;
      return compileErrorResult(
        options,
        [
          {
            ...(line ? { line } : {}),
            ...(column ? { column } : {}),
            message,
            severity: 'error',
          },
        ],
        Date.now() - started,
        started,
      );
    }

    const checker = await resolveChecker(meta, options.problemDir);

    const testResults: TestResult[] = [];
    const concealed: (string | undefined)[] = [];
    for (const [index, entry] of tests.entries()) {
      const record = collected.fatal ?? collected.byIndex.get(index);
      testResults.push(
        await buildTestResult({
          index,
          entry,
          record,
          meta,
          language,
          checker,
          crashStderr: collected.stderr,
        }),
      );
      concealed.push(concealedMessage(record, language));
    }

    applyRevealPolicy(testResults, tests, options.revealAll === true, concealed);

    const verdict = worstVerdict(testResults.map((t) => t.verdict));
    return {
      slug: meta.slug,
      language,
      kind: options.kind,
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

function prepareOptions(
  root: string,
  multiplier: number,
  signal: AbortSignal | undefined,
): PrepareOptions {
  return {
    compileTimeoutMs: Math.round(DEFAULT_COMPILE_TIMEOUT_MS * multiplier),
    cacheDir: judgeCacheDir(root),
    ...(signal ? { signal } : {}),
  };
}

/** Every test CE, since none of them ran. */
function compileErrorResult(
  options: RunProblemOptions,
  errors: CompileError[],
  compileTimeMs: number,
  started: number,
): RunResult {
  return {
    slug: options.meta.slug,
    language: options.language,
    kind: options.kind,
    problemVersion: options.meta.version,
    verdict: 'CE',
    passed: 0,
    total: options.tests.length,
    totalTimeMs: Date.now() - started,
    compileTimeMs,
    compileErrors: errors,
    tests: options.tests.map((entry, index) => ({
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

// ---------------------------------------------------------------------------
// Execution, with the restart after a failure
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
    ...(meta.mode === 'function' && meta.cycle ? { cycle: meta.cycle } : {}),
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

interface ExecuteArgs {
  executor: Executor;
  workspace: Workspace;
  meta: ProblemMeta;
  tests: readonly JudgeTest[];
  perTestMs: number;
  signal: AbortSignal | undefined;
  shared: string | undefined;
}

/**
 * Runs the tests as one batch, and after anything that stops a batch early -
 * a per-test timeout, a crash, a `System.exit` - starts a new batch at the test
 * after the one that failed (ROADMAP P2-17).
 *
 * This revises D3's fallback, which re-ran every remaining test in a process
 * of its own. That was right for the failing test and wrong for the rest: after
 * one TLE in twenty hidden tests the other nineteen paid a JVM start each, and
 * none of them had done anything to deserve it. Resuming the batch keeps what
 * isolation was for - the failing test cannot take the others down with it -
 * at the cost of one process per failure plus one, instead of one per test.
 * Every batch has the stall watchdog, including the restarts, which the
 * one-per-test reruns never did.
 */
async function executeAll(args: ExecuteArgs): Promise<Collected> {
  const { executor, workspace, meta, tests, perTestMs, signal, shared } = args;
  const byIndex = new Map<number, HarnessRecord>();
  let outputTruncated = false;
  let stderr = '';
  let restarts = 0;
  let pending = tests.map((_, i) => i);
  // The gap between results, not the whole run (ROADMAP P2-13). The harness's
  // own per-test watchdog cannot interrupt an uninterruptible call, so
  // without this a single hang costs the batch's whole wall clock.
  const stallMs = perTestMs + STALL_SLACK_MS + executor.startupMs;

  while (pending.length > 0) {
    const batch = await executor.run(
      workspace,
      payloadFor(workspace, executor, meta, tests, pending, perTestMs),
      {
        wallClockMs: pending.length * perTestMs + BATCH_OVERHEAD_MS,
        stallMs,
        ...(signal ? { signal } : {}),
        ...(shared === undefined ? {} : { shared }),
      },
    );
    throwIfAborted(signal);

    if (batch.outputTruncated) outputTruncated = true;
    if (batch.stderr) stderr = batch.stderr;

    const fatal = batch.records.find(isFatal);
    if (fatal && restarts === 0) {
      // One fatal record explains every test; the caller fans it out.
      return { byIndex, fatal, isolationFallback: false, outputTruncated, stderr };
    }
    if (!batch.ready && restarts === 0) {
      // It never finished loading (ROADMAP P2-17): a loop at module level, a
      // static initialiser that exits. Every test would fail the same way, so
      // re-running them one by one would only multiply the wait.
      return {
        byIndex,
        fatal: loadFailure(batch, stallMs),
        isolationFallback: false,
        outputTruncated,
        stderr,
      };
    }

    const recorded: HarnessTestRecord[] = [];
    for (const record of batch.records) {
      if (isFatal(record)) continue;
      byIndex.set(record.index, record);
      recorded.push(record);
      if (record.outputTruncated) outputTruncated = true;
    }

    const remaining = pending.filter((i) => !byIndex.has(i));
    if (remaining.length === 0) break;

    // The batch stopped early. The test that was running when it did is the
    // first one without a record - unless the harness recorded it on the way
    // out, which a per-test timeout and a `System.exit` both do.
    const culprit = remaining[0]!;
    if (!inFlightRecorded(batch)) {
      byIndex.set(culprit, unreported(batch, culprit, perTestMs, recorded));
      remaining.shift();
    }
    // A restart that fails before loading is not something the first load
    // did, so nothing about it can be trusted to explain the rest; the
    // culprit above has already taken the blame, which is what keeps this
    // loop finite.
    restarts += 1;
    pending = remaining;
  }

  return { byIndex, isolationFallback: restarts > 0, outputTruncated, stderr };
}

/** The harness wrote the in-flight test's record before the batch ended. */
function inFlightRecorded(batch: HarnessRun): boolean {
  if (batch.killed) {
    // Our watchdog struck; only if the harness had just written a timeout
    // record and not yet exited is that record the in-flight test's.
    const last = batch.records.at(-1);
    return last !== undefined && !isFatal(last) && last.status === 'timeout';
  }
  return batch.exitCode === HARNESS_EXIT.timeout || batch.exitCode === HARNESS_EXIT.abandoned;
}

/**
 * The record for a test that was running when its process died without saying
 * why: our watchdog (a timeout), or something below the harness (a crash).
 */
function unreported(
  batch: HarnessRun,
  index: number,
  perTestMs: number,
  recorded: readonly HarnessTestRecord[],
): HarnessTestRecord {
  if (batch.killed) {
    return {
      index,
      status: 'timeout',
      timeMs: perTestMs,
      stdout: '',
      stderr: '',
      outputTruncated: false,
    };
  }
  // The batch's time less what the finished tests reported: start-up is in
  // it, but it is the closest thing to this test's time there is.
  const others = recorded.reduce((sum, record) => sum + record.timeMs, 0);
  return {
    index,
    status: 'error',
    timeMs: Math.max(0, batch.elapsedMs - others),
    stdout: '',
    stderr: '',
    outputTruncated: false,
    error: {
      type: 'ProcessExited',
      message: describeExit(batch.exitCode, batch.signal, batch.stderr),
      traceback: '',
    },
  };
}

/** The fatal record for a first batch that never reported being ready. */
function loadFailure(batch: HarnessRun, stallMs: number): HarnessFatalRecord {
  if (batch.killed) {
    return {
      event: 'fatal',
      kind: 'load',
      timedOut: true,
      message: `the solution did not finish loading within ${(stallMs / 1000).toFixed(1)}s. Code that runs as the file loads - at the top level in Python, in a static initialiser in Java - runs before any test does, so a loop there never reaches one.`,
      traceback: '',
    };
  }
  return {
    event: 'fatal',
    kind: 'load',
    message: `the solution could not be loaded: ${describeExit(batch.exitCode, batch.signal, batch.stderr)}`,
    traceback: batch.stderr.trim(),
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
      verdict: record.kind === 'compile' ? 'CE' : record.timedOut ? 'TLE' : 'RE',
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
      // An operations sequence that raised halfway still produced the returns
      // before it, and both harnesses now report them (ROADMAP P2-12). Being
      // able to count the calls that worked is most of reading this: "the
      // twentieth pop threw" is a different bug from "the first push did".
      ...(record.returned !== undefined ? { actual: record.returned } : {}),
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
 * than claiming a limit the judge does not actually enforce (see D3, P0-7). A
 * StackOverflowError is RE in both: the stack is a limit of the language, not
 * one the judge sets on memory.
 */
function runtimeVerdict(language: Language, record: HarnessTestRecord): Verdict {
  if (language === 'java' && record.error?.type === 'OutOfMemoryError') return 'MLE';
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
    const result = await compare(test.expected, record.returned, options, meta);
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
      const result = await compare(
        want.value,
        actualArgs.get(want.index) as JsonValue,
        options,
        meta,
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

/**
 * `compareValues`, with a checker that throws judged as a wrong answer
 * (ROADMAP P2-19).
 *
 * A checker is written against the answers it expects, and a wrong answer is
 * exactly the input it was not written for: `actual.length` on a number, a
 * missing key. The throw used to escape the judge and come back as a 500 for
 * what is, from the user's side, simply a wrong answer - so it is one, with the
 * checker's complaint as the message, and logged, because it is also a checker
 * that could be more careful.
 */
async function compare(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
  options: Parameters<typeof compareValues>[2],
  meta: ProblemMeta,
): Promise<CompareResult> {
  if (meta.comparator.kind !== 'checker') return compareValues(expected, actual, options);
  try {
    return await compareValues(expected, actual, options);
  } catch (error) {
    logger.warn(
      { err: error, slug: meta.slug },
      'checker threw; the test is judged a wrong answer',
    );
    const reason = error instanceof Error ? error.message : String(error);
    return { pass: false, message: `checker failed: ${reason}` };
  }
}

// ---------------------------------------------------------------------------
// Hidden-test reveal policy (ROADMAP P2-6)
// ---------------------------------------------------------------------------

/**
 * What a hidden test that stays hidden may still say about how it failed
 * (ROADMAP P2-19): the kind of failure and nothing derived from its input.
 *
 * An exception's message routinely is its input - `KeyError: 48213`, `index 9
 * out of bounds for length 7` - so a RE on a concealed test showed part of the
 * hidden set. The type alone still tells the user which of their failure modes
 * to look at.
 */
function concealedMessage(record: HarnessRecord | undefined, language: Language): string {
  if (!record) return 'the judge received no result for this test';
  // A load failure happened before any input was read, and is the same on
  // every test, samples included.
  if (isFatal(record)) return record.message;
  if (record.status === 'timeout') return 'exceeded the time limit';
  if (record.status === 'error') {
    const type = record.error?.type ?? 'the solution raised';
    return runtimeVerdict(language, record) === 'MLE' ? `${type}: exceeded the memory limit` : type;
  }
  return '';
}

/**
 * Samples and custom cases are always fully visible. Hidden tests are not, with
 * one exception: the first one that fails is revealed, because a Submit that
 * only says "wrong answer on test 7" gives the user nothing to work with.
 */
function applyRevealPolicy(
  results: TestResult[],
  tests: readonly JudgeTest[],
  revealAll: boolean,
  concealed: readonly (string | undefined)[],
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
    const safe = concealed[index];
    if (result.verdict === 'WA' || result.verdict === 'AC' || !safe) delete result.message;
    else result.message = safe;
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
  options: { workspaceRoot?: string; timeoutMultiplier?: number; executor?: ExecutorKind } = {},
): Promise<{ ok: boolean; errors: CompileError[]; timeMs: number }> {
  const executor = executorFor(language, options.executor);
  const root = options.workspaceRoot ?? paths.judgeWorkspaces;
  const workspace = await createWorkspace(root);
  try {
    const checked = await executor.check(
      workspace,
      code,
      prepareOptions(root, options.timeoutMultiplier ?? 1, undefined),
    );
    return checked.ok
      ? { ok: true, errors: [], timeMs: checked.timeMs }
      : { ok: false, errors: checked.errors, timeMs: checked.timeMs };
  } finally {
    await workspace.dispose();
  }
}
