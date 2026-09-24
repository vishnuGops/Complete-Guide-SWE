import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HarnessPayload } from '../protocol.js';
import { localLauncher, type Launcher } from './launcher.js';
import { compileTimeoutMessage } from './compileErrors.js';
import { PAYLOAD_FILE, RESULTS_FILE, runHarness } from './harnessRun.js';
import type { Workspace } from '../workspace.js';
import type { Executor, HarnessRun, PrepareOptions, PrepareResult, RunLimits } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** src/judge/executors -> src/judge/harness (and the same shape under dist/). */
const HARNESS_SOURCE = path.resolve(HERE, '..', 'harness', 'runner.py');

export { PYTHON_COMMAND } from './commands.js';

export { RESULTS_FILE };
const HARNESS_FILE = 'runner.py';
const SOLUTION_FILE = 'solution.py';

/**
 * Python's answer to "compile", for `checkCompiles` alone: `compile()` turns a
 * syntax error into a diagnostic with a line and column without running
 * anything.
 *
 * A Run and a Submit no longer pay for it (ROADMAP P2-18). It was a whole
 * interpreter start - a sixth of a Python Run on this machine, and a container
 * start under Docker - spent learning what the harness learns anyway when it
 * imports the solution, and already reports as a fatal `compile` record with the
 * same line and column. The validator keeps it because checking a starter has no
 * harness run to ride on.
 */
const SYNTAX_CHECK = `
import json, sys, traceback
path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as handle:
        compile(handle.read(), path, "exec")
except SyntaxError as err:
    print(json.dumps({
        "line": err.lineno,
        "column": err.offset,
        "message": err.msg or "syntax error",
        "text": (err.text or "").rstrip(),
    }))
    sys.exit(1)
except Exception as err:
    print(json.dumps({"message": "%s: %s" % (type(err).__name__, err)}))
    sys.exit(1)
sys.exit(0)
`.trim();

/**
 * The Python executor, over whichever launcher decides where it runs (P9-2).
 * Every path a program is handed goes through `launcher.path`, because inside a
 * container the workspace is not where this process created it.
 */
export function createPythonExecutor(launcher: Launcher): Executor {
  async function writeSources(workspace: Workspace, code: string): Promise<void> {
    await workspace.write(SOLUTION_FILE, code);
    await fs.copyFile(HARNESS_SOURCE, workspace.file(HARNESS_FILE));
  }

  return {
    language: 'python',
    solutionFile: SOLUTION_FILE,
    startupMs: launcher.startupMs,

    async prepare(workspace: Workspace, code: string): Promise<PrepareResult> {
      const started = Date.now();
      await writeSources(workspace, code);
      return { ok: true, timeMs: Date.now() - started };
    },

    async check(
      workspace: Workspace,
      code: string,
      options: PrepareOptions,
    ): Promise<PrepareResult> {
      const started = Date.now();
      await writeSources(workspace, code);

      const result = await launcher.run(
        'python',
        // -X utf8 forces UTF-8 regardless of the console code page, which on
        // Windows is otherwise cp1252 and mangles any non-ASCII source.
        // -I isolates: no user site-packages, no PYTHON* env, and neither the cwd
        // nor the script's own directory on `sys.path` - which is why the harness
        // loads `solution.py` by path rather than importing it by name (P2-12).
        ['-X', 'utf8', '-I', '-c', SYNTAX_CHECK, launcher.path(workspace, SOLUTION_FILE)],
        workspace,
        {
          timeoutMs: options.compileTimeoutMs,
          outputCap: 16 * 1024,
          ...(options.signal ? { signal: options.signal } : {}),
        },
      );

      const timeMs = Date.now() - started;
      if (result.code === 0) return { ok: true, timeMs };

      if (result.killed) {
        return {
          ok: false,
          timeMs,
          errors: [{ message: compileTimeoutMessage(options.compileTimeoutMs), severity: 'error' }],
          stderr: result.stderr,
        };
      }

      const diagnostic = parseSyntaxDiagnostic(result.stdout);
      return {
        ok: false,
        timeMs,
        errors: diagnostic
          ? [diagnostic]
          : [
              {
                message: result.stderr.trim() || 'the solution could not be parsed',
                severity: 'error',
              },
            ],
        stderr: result.stderr,
      };
    },

    run(workspace: Workspace, payload: HarnessPayload, limits: RunLimits): Promise<HarnessRun> {
      return runHarness(
        launcher,
        workspace,
        'python',
        [
          '-X',
          'utf8',
          '-I',
          launcher.path(workspace, HARNESS_FILE),
          launcher.path(workspace, PAYLOAD_FILE),
        ],
        payload,
        SOLUTION_FILE,
        limits,
      );
    },
  };
}

export const pythonExecutor: Executor = createPythonExecutor(localLauncher);

function parseSyntaxDiagnostic(
  stdout: string,
): { line?: number; column?: number; message: string; severity: 'error' } | undefined {
  const line = stdout.trim().split('\n').pop();
  if (!line) return undefined;
  try {
    const parsed = JSON.parse(line) as {
      line?: number | null;
      column?: number | null;
      message?: string;
    };
    if (typeof parsed.message !== 'string') return undefined;
    return {
      ...(typeof parsed.line === 'number' && parsed.line > 0 ? { line: parsed.line } : {}),
      ...(typeof parsed.column === 'number' && parsed.column > 0 ? { column: parsed.column } : {}),
      message: parsed.message,
      severity: 'error',
    };
  } catch {
    return undefined;
  }
}
