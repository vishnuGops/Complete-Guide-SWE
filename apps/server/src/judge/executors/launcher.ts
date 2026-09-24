import path from 'node:path';
import { runProcess, type SpawnResult } from '../process.js';
import type { Workspace } from '../workspace.js';
import { JAVAC_COMMAND, JAVA_COMMAND, PYTHON_COMMAND } from './commands.js';

/**
 * How a language executor gets a program started (ROADMAP P9-2).
 *
 * The executors know what to run - which flags, which harness, how to read a
 * compiler's complaints. What they must not know is *where* it runs, because
 * that is the one thing the Docker executor changes: the same `python -X utf8
 * -I runner.py payload.json` either starts on this machine with the workspace
 * at its real path, or starts in a container that sees the workspace at `/ws`.
 *
 * So a launcher answers two questions: what a workspace file is called from the
 * program's side, and how to run a program against a workspace.
 */

/**
 * The judge cannot run anything at all, for a reason that is about this machine
 * rather than the code - Docker not running, an image not pulled. The message
 * is written for the user and goes to them as it is; everything else a judge
 * throws is a bug, and they are told only that the log has the details.
 */
export class JudgeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JudgeUnavailableError';
  }
}

/** The three programs the judge runs. Never a free-form command. */
export type Program = 'python' | 'javac' | 'java';

export interface LaunchOptions {
  timeoutMs: number;
  outputCap: number;
  stall?: { ms: number; progress: () => number };
  /** Kills the program when the run is cancelled (ROADMAP P2-17). */
  signal?: AbortSignal;
  /**
   * A directory of prebuilt judge files the program reads but must not write -
   * the compiled Java harness (ROADMAP P2-18). `shared(...)` names it as the
   * program sees it.
   */
  shared?: string;
}

export interface Launcher {
  /** For log lines and errors: `local`, or `docker`. */
  readonly kind: 'local' | 'docker';

  /**
   * Time a program may take to *start* before it has done anything, added to the
   * judge's slack. A local interpreter is covered by the judge's own margin; a
   * container start is not.
   */
  readonly startupMs: number;

  /** A file in the workspace, as the program will see it. */
  path(workspace: Workspace, name: string): string;

  /** The workspace directory itself, as the program will see it. */
  dir(workspace: Workspace): string;

  /** `LaunchOptions.shared`, as the program will see it. */
  shared(hostDir: string): string;

  /** The class-path separator of the machine the program runs on. */
  readonly pathDelimiter: string;

  run(
    program: Program,
    args: readonly string[],
    workspace: Workspace,
    options: LaunchOptions,
  ): Promise<SpawnResult>;
}

const LOCAL_COMMANDS: Record<Program, string> = {
  python: PYTHON_COMMAND,
  javac: JAVAC_COMMAND,
  java: JAVA_COMMAND,
};

/** The runtimes on this machine, run as plain subprocesses (ROADMAP D3). */
export const localLauncher: Launcher = {
  kind: 'local',
  startupMs: 0,
  path: (workspace, name) => workspace.file(name),
  dir: (workspace) => workspace.dir,
  shared: (hostDir) => hostDir,
  pathDelimiter: path.delimiter,
  run: (program, args, workspace, options) =>
    runProcess({
      command: LOCAL_COMMANDS[program],
      args: [...args],
      cwd: workspace.dir,
      timeoutMs: options.timeoutMs,
      outputCap: options.outputCap,
      ...(options.stall ? { stall: options.stall } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    }),
};
