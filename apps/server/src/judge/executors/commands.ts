import type { ExecutorKind } from '@devpromax/shared';

/**
 * The three executables the judge shells out to.
 *
 * Their own module, tiny and importing nothing, so that something which only
 * needs to know *which* command would be run - the first-run doctor (ROADMAP
 * P8-3) - does not have to pull the executors, the harness protocol and the
 * process machinery in behind them. A diagnostic that drags the judge into its
 * import graph is a diagnostic that cannot run when the judge is the problem.
 *
 * Each can be overridden, which is the answer for a machine with three JDKs, or
 * with Windows' Microsoft Store alias sitting on `python`.
 */
export const PYTHON_COMMAND = process.env['DEVPROMAX_PYTHON'] ?? 'python';
export const JAVAC_COMMAND = process.env['DEVPROMAX_JAVAC'] ?? 'javac';
export const JAVA_COMMAND = process.env['DEVPROMAX_JAVA'] ?? 'java';

/**
 * Where the judge runs code (ROADMAP P9-2): `local`, the default, starts the
 * runtimes above as subprocesses; `docker` starts each step in a throwaway
 * container from the two images below, and needs no Python or JDK here at all.
 *
 * An environment variable rather than a setting, like the three commands above:
 * it is a fact about the machine - is Docker installed, are the images pulled -
 * and not a preference someone should be able to flip from a browser tab.
 */
export type { ExecutorKind };

export function parseExecutorKind(value: string | undefined): ExecutorKind {
  if (value === undefined || value.trim() === '') return 'local';
  const kind = value.trim().toLowerCase();
  if (kind === 'local' || kind === 'docker') return kind;
  // A typo here would otherwise quietly run everything unsandboxed - the
  // opposite of what someone who typed DEVPROMAX_EXECUTOR was asking for.
  throw new Error(`DEVPROMAX_EXECUTOR must be "local" or "docker"; got "${value}".`);
}

export const EXECUTOR_KIND: ExecutorKind = parseExecutorKind(process.env['DEVPROMAX_EXECUTOR']);

export const DOCKER_COMMAND = process.env['DEVPROMAX_DOCKER'] ?? 'docker';

/**
 * The images, by tag. Python matches the version the catalogue is generated
 * with; Java matches `--release 21` and CI. Both are overridable, because a
 * machine behind a registry mirror names them differently.
 */
export const DOCKER_IMAGES = {
  python: process.env['DEVPROMAX_DOCKER_PYTHON_IMAGE'] ?? 'python:3.14-slim',
  java: process.env['DEVPROMAX_DOCKER_JAVA_IMAGE'] ?? 'eclipse-temurin:21-jdk',
} as const;
