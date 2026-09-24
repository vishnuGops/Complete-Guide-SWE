import type { CompileError, Language } from '@devpromax/shared';
import type { HarnessPayload, HarnessRecord } from '../protocol.js';
import type { Workspace } from '../workspace.js';

export interface PrepareSuccess {
  ok: true;
  /** Time spent compiling, reported next to the verdict. */
  timeMs: number;
  /**
   * Prebuilt judge files every run of this language shares - the compiled Java
   * harness (ROADMAP P2-18). Opaque to the core, which hands it back to `run`.
   */
  shared?: string;
}

export interface PrepareFailure {
  ok: false;
  timeMs: number;
  errors: CompileError[];
  /** Raw compiler output, kept for the stderr disclosure in the results panel. */
  stderr: string;
}

export type PrepareResult = PrepareSuccess | PrepareFailure;

export interface PrepareOptions {
  compileTimeoutMs: number;
  /**
   * Where build products that outlive a run are kept (ROADMAP P2-18): a sibling
   * of the workspace root, never inside it, because the startup sweep deletes
   * whatever it finds there.
   */
  cacheDir: string;
  signal?: AbortSignal;
}

export interface RunLimits {
  wallClockMs: number;
  /**
   * Bounds the gap *between* results rather than the whole run (ROADMAP
   * P2-13): the harness's own per-test watchdog cannot interrupt an
   * uninterruptible call - a catastrophic regex, `[0] * 10**9` - so without
   * this the only bound is the batch's wall clock, which for twenty hidden
   * tests is over a minute before the isolation fallback even starts.
   */
  stallMs?: number;
  signal?: AbortSignal;
  /** `PrepareSuccess.shared`, passed back. */
  shared?: string;
}

export interface HarnessRun {
  records: HarnessRecord[];
  /** The harness loaded the solution and found its entry point (ROADMAP P2-17). */
  ready: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  /** The judge's outer watchdog fired and the process tree was killed. */
  killed: boolean;
  stdout: string;
  stderr: string;
  outputTruncated: boolean;
  elapsedMs: number;
}

/**
 * Everything the judge core needs from a language.
 *
 * Keeping this interface small is what makes ROADMAP P9-2 (a Docker executor)
 * and P9-3 (more languages) additive rather than a rewrite: the core never
 * learns what a `.py` or a `.class` is.
 */
export interface Executor {
  readonly language: Language;

  /** Name the user's source takes inside the workspace. */
  readonly solutionFile: string;

  /**
   * Extra time a step needs before it can produce anything - a container start
   * (ROADMAP P9-2). The judge adds it to its own slack, never to the budget
   * the user's code is timed against.
   */
  readonly startupMs: number;

  /**
   * Gets the workspace ready to run: writes the harness and compiles if the
   * language needs it. Runs once per judge run, never per test.
   *
   * Python does no work here that a run would repeat (ROADMAP P2-18): the
   * harness parses the solution as it loads it, and reports a syntax error as
   * a fatal `compile` record the core turns into CE.
   */
  prepare(workspace: Workspace, code: string, options: PrepareOptions): Promise<PrepareResult>;

  /**
   * Compiles (Java) or parses (Python) without running anything - for the
   * validator's "is the starter a legal program" (ROADMAP P2-7), which has no
   * harness run to find a syntax error for it.
   */
  check(workspace: Workspace, code: string, options: PrepareOptions): Promise<PrepareResult>;

  /** Runs a batch of tests in a single process. */
  run(workspace: Workspace, payload: HarnessPayload, limits: RunLimits): Promise<HarnessRun>;
}
