import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTPUT_CAP_BYTES } from '@devpromax/shared';
import { parseResultLines } from '../protocol.js';
import type { HarnessPayload } from '../protocol.js';
import { runProcess } from '../process.js';
import type { Workspace } from '../workspace.js';
import type { Executor, HarnessRun, PrepareResult } from './types.js';
import {
  compileTimeoutMessage,
  parseJavacOutput,
  summariseCompileFailure,
} from './compileErrors.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS_SOURCE = path.resolve(HERE, '..', 'harness', 'DevProMaxMain.java');

export const JAVAC_COMMAND = process.env['DEVPROMAX_JAVAC'] ?? 'javac';
export const JAVA_COMMAND = process.env['DEVPROMAX_JAVA'] ?? 'java';

const SOLUTION_FILE = 'Solution.java';
/**
 * The harness, under a name nobody would write by accident (ROADMAP P2-11).
 *
 * It used to be `Main.java` holding `Main`, `Json` and `Convert`, which are
 * three names a user might reasonably give a helper class. Declaring one made
 * javac report `duplicate class` against the *harness* file, which this
 * executor then reported as "the judge's Java harness failed to compile" - our
 * bug, apparently, for the user's helper. The names are `DevProMax*` now, and
 * the ones we cannot rename because the user's own signatures use them -
 * `ListNode`, `TreeNode` - are named as reserved in the message instead.
 */
const HARNESS_FILE = 'DevProMaxMain.java';
const PAYLOAD_FILE = 'payload.json';
const RESULTS_FILE = 'results.jsonl';

/** Language level users write against (CLAUDE.md > Environment). */
export const JAVA_RELEASE = '21';

/**
 * Heap ceiling. This is what makes MLE a verdict we can honestly report for
 * Java: without `-Xmx` an allocation storm would be killed by the OS instead,
 * and the user would see a mystery crash.
 */
const MAX_HEAP = '-Xmx256m';
/** Stack, matched by the harness's per-test thread so deep recursion behaves alike. */
const MAX_STACK = '-Xss64m';

export const javaExecutor: Executor = {
  language: 'java',
  solutionFile: SOLUTION_FILE,

  async prepare(
    workspace: Workspace,
    code: string,
    compileTimeoutMs: number,
  ): Promise<PrepareResult> {
    const started = Date.now();
    // The user's classes are package-private, so the file name never has to
    // match the class name - `Solution.java` holds `class MinValueStack` quite
    // happily, and javac's line numbers then line up with the user's editor.
    await workspace.write(SOLUTION_FILE, code);
    await fs.copyFile(HARNESS_SOURCE, workspace.file(HARNESS_FILE));

    const result = await runProcess({
      command: JAVAC_COMMAND,
      args: [
        '--release',
        JAVA_RELEASE,
        '-encoding',
        'UTF-8',
        '-nowarn',
        '-d',
        workspace.dir,
        // The harness first, the user's file second, deliberately: javac
        // reports a duplicate class at its *later* definition, so this order
        // puts the diagnostic on the user's line - where a Monaco marker can go
        // - rather than on a harness file they have never seen.
        workspace.file(HARNESS_FILE),
        workspace.file(SOLUTION_FILE),
      ],
      cwd: workspace.dir,
      timeoutMs: compileTimeoutMs,
      outputCap: 64 * 1024,
    });

    const timeMs = Date.now() - started;
    if (result.code === 0) return { ok: true, timeMs };

    // A killed javac produced no diagnostics at all, so the generic summary
    // called it "compilation failed" - which reads as "your code is wrong" for
    // what is actually a machine too busy to compile it (ROADMAP P2-11).
    if (result.killed) {
      return {
        ok: false,
        timeMs,
        errors: [{ message: compileTimeoutMessage(compileTimeoutMs), severity: 'error' }],
        stderr: result.stderr,
      };
    }

    const output = `${result.stdout}\n${result.stderr}`;
    const { errors, harnessErrors } = parseJavacOutput(output, SOLUTION_FILE);

    if (errors.length === 0 && harnessErrors.length > 0) {
      // The harness failed to compile, which is our bug and not the user's.
      // Say so plainly rather than presenting it as their compile error.
      return {
        ok: false,
        timeMs,
        errors: [
          {
            message: `the judge's Java harness failed to compile: ${summariseCompileFailure(output)}`,
            severity: 'error',
          },
        ],
        stderr: output,
      };
    }

    return {
      ok: false,
      timeMs,
      errors:
        errors.length > 0
          ? errors
          : [{ message: summariseCompileFailure(output), severity: 'error' }],
      stderr: output,
    };
  },

  async run(
    workspace: Workspace,
    payload: HarnessPayload,
    wallClockMs: number,
  ): Promise<HarnessRun> {
    await workspace.write(PAYLOAD_FILE, JSON.stringify(payload));
    await fs.rm(workspace.file(RESULTS_FILE), { force: true });

    const result = await runProcess({
      command: JAVA_COMMAND,
      args: [
        MAX_HEAP,
        MAX_STACK,
        '-Dfile.encoding=UTF-8',
        '-XX:+UseSerialGC',
        '-cp',
        workspace.dir,
        'DevProMaxMain',
        workspace.file(PAYLOAD_FILE),
      ],
      cwd: workspace.dir,
      timeoutMs: wallClockMs,
      outputCap: OUTPUT_CAP_BYTES,
    });

    const records = parseResultLines(await workspace.read(RESULTS_FILE));

    return {
      records,
      exitCode: result.code,
      signal: result.signal,
      killed: result.killed,
      stdout: result.stdout,
      stderr: result.stderr,
      outputTruncated: result.outputTruncated,
      elapsedMs: result.elapsedMs,
    };
  },
};
