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

  /** `LaunchOptions.shared`, as a program running in `workspace` will see it. */
  shared(workspace: Workspace, hostDir: string): string;

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

/**
 * `target` as a program whose working directory is `workspace` should be told
 * it: relative wherever that is possible (ROADMAP P10-1).
 *
 * Windows hands a JVM its command line in the ANSI code page, so an absolute
 * path through a directory named `测试` reached `javac` on a cp1252 machine as
 * `??` - "Invalid filename" - and every Java run failed for anyone whose profile
 * name the code page cannot spell. A relative path never mentions the parts it
 * cannot spell. Across drives there is no relative path, and the absolute one
 * is the best there is; the judge keeps its cache beside its workspaces, so that
 * takes a data directory split over two drives by hand.
 */
export function relativeTo(workspace: Workspace, target: string): string {
  const relative = path.relative(workspace.dir, target);
  if (relative === '') return '.';
  return path.isAbsolute(relative) ? target : relative;
}

/**
 * The runtimes on this machine, run as plain subprocesses (ROADMAP D3), each
 * with the workspace as its working directory and every path named from there.
 */
export const localLauncher: Launcher = {
  kind: 'local',
  startupMs: 0,
  path: (_workspace, name) => name,
  dir: () => '.',
  shared: relativeTo,
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
