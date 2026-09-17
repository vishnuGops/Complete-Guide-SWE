import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTPUT_CAP_BYTES } from '@devpromax/shared';
import { parseResultLines } from '../protocol.js';
import type { HarnessPayload } from '../protocol.js';
import { runProcess } from '../process.js';
import type { Workspace } from '../workspace.js';
import type { Executor, HarnessRun, PrepareResult } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** src/judge/executors -> src/judge/harness (and the same shape under dist/). */
const HARNESS_SOURCE = path.resolve(HERE, '..', 'harness', 'runner.py');

export const PYTHON_COMMAND = process.env['DEVPROMAX_PYTHON'] ?? 'python';

export const RESULTS_FILE = 'results.jsonl';
const PAYLOAD_FILE = 'payload.json';
const HARNESS_FILE = 'runner.py';
const SOLUTION_FILE = 'solution.py';

/**
 * Python's answer to "compile": `py_compile` turns a syntax error into a
 * diagnostic with a line and column before any test runs, so the user gets the
 * same CE-with-markers experience Java gives rather than a runtime traceback on
 * test 1.
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

export const pythonExecutor: Executor = {
  language: 'python',
  solutionFile: SOLUTION_FILE,

  async prepare(
    workspace: Workspace,
    code: string,
    compileTimeoutMs: number,
  ): Promise<PrepareResult> {
    const started = Date.now();
    await workspace.write(SOLUTION_FILE, code);
    await fs.copyFile(HARNESS_SOURCE, workspace.file(HARNESS_FILE));

    const result = await runProcess({
      command: PYTHON_COMMAND,
      // -X utf8 forces UTF-8 regardless of the console code page, which on
      // Windows is otherwise cp1252 and mangles any non-ASCII source.
      // -I isolates: no user site-packages, no PYTHON* env, cwd off sys.path.
      args: ['-X', 'utf8', '-I', '-c', SYNTAX_CHECK, workspace.file(SOLUTION_FILE)],
      cwd: workspace.dir,
      timeoutMs: compileTimeoutMs,
      outputCap: 16 * 1024,
    });

    const timeMs = Date.now() - started;
    if (result.code === 0) return { ok: true, timeMs };

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

  async run(
    workspace: Workspace,
    payload: HarnessPayload,
    wallClockMs: number,
  ): Promise<HarnessRun> {
    await workspace.write(PAYLOAD_FILE, JSON.stringify(payload));
    await fs.rm(workspace.file(RESULTS_FILE), { force: true });

    const result = await runProcess({
      command: PYTHON_COMMAND,
      args: ['-X', 'utf8', '-I', workspace.file(HARNESS_FILE), workspace.file(PAYLOAD_FILE)],
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
