import type { CompileError, Language } from '@devpromax/shared';
import type { HarnessPayload, HarnessRecord } from '../protocol.js';
import type { Workspace } from '../workspace.js';

export interface PrepareSuccess {
  ok: true;
  /** Time spent compiling, reported next to the verdict. */
  timeMs: number;
}

export interface PrepareFailure {
  ok: false;
  timeMs: number;
  errors: CompileError[];
  /** Raw compiler output, kept for the stderr disclosure in the results panel. */
  stderr: string;
}

export type PrepareResult = PrepareSuccess | PrepareFailure;

export interface HarnessRun {
  records: HarnessRecord[];
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
   * Writes the harness and compiles if the language needs it. Runs once per
   * judge run, never per test.
   */
  prepare(workspace: Workspace, code: string, compileTimeoutMs: number): Promise<PrepareResult>;

  /** Runs a batch of tests in a single process. */
  run(workspace: Workspace, payload: HarnessPayload, wallClockMs: number): Promise<HarnessRun>;
}
