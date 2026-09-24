import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { OUTPUT_CAP_BYTES } from '@devpromax/shared';
import { parseResults, type HarnessPayload } from '../protocol.js';
import type { Workspace } from '../workspace.js';
import type { Launcher, Program } from './launcher.js';
import type { HarnessRun, RunLimits } from './types.js';

export const PAYLOAD_FILE = 'payload.json';
export const RESULTS_FILE = 'results.jsonl';

/**
 * One batch through a harness, for either language (ROADMAP P2-19).
 *
 * The Python and Java executors had this twice, line for line; they differ in
 * the program and its arguments and in nothing that happens around them.
 */
export async function runHarness(
  launcher: Launcher,
  workspace: Workspace,
  program: Program,
  args: readonly string[],
  payload: HarnessPayload,
  solutionFile: string,
  limits: RunLimits,
): Promise<HarnessRun> {
  // The harness opens these two by the paths in the payload, so they are
  // named as the harness will see them.
  const located: HarnessPayload = {
    ...payload,
    solutionPath: launcher.path(workspace, solutionFile),
    resultsPath: launcher.path(workspace, RESULTS_FILE),
  };
  await workspace.write(PAYLOAD_FILE, JSON.stringify(located));
  await fs.rm(workspace.file(RESULTS_FILE), { force: true });

  const result = await launcher.run(program, args, workspace, {
    timeoutMs: limits.wallClockMs,
    outputCap: OUTPUT_CAP_BYTES,
    // Progress is the results file growing, which happens once the solution
    // has loaded and once per completed test (ROADMAP P2-13). Read on this
    // side, at the real path.
    ...(limits.stallMs === undefined
      ? {}
      : {
          stall: {
            ms: limits.stallMs,
            progress: () => resultsSizeOf(workspace.file(RESULTS_FILE)),
          },
        }),
    ...(limits.signal ? { signal: limits.signal } : {}),
    ...(limits.shared === undefined ? {} : { shared: limits.shared }),
  });

  const { records, ready } = parseResults(await workspace.read(RESULTS_FILE));

  return {
    records,
    ready,
    exitCode: result.code,
    signal: result.signal,
    killed: result.killed,
    stdout: result.stdout,
    stderr: result.stderr,
    outputTruncated: result.outputTruncated,
    elapsedMs: result.elapsedMs,
  };
}

/**
 * The size of the results file, for the stall watchdog (ROADMAP P2-13).
 *
 * Synchronous and forgiving: it runs on a timer beside a child process, the
 * file may not exist yet, and a missing file is simply "no progress".
 */
function resultsSizeOf(path: string): number {
  try {
    return fsSync.statSync(path).size;
  } catch {
    return 0;
  }
}
