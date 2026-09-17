import path from 'node:path';
import type { CompileError } from '@devpromax/shared';

/** `<path>:<line>: error: <message>` — javac's default diagnostic format. */
const DIAGNOSTIC = /^(.*?):(\d+): (error|warning): (.*)$/;

export interface ParsedDiagnostics {
  /** Diagnostics about the user's own source, ready for Monaco markers. */
  errors: CompileError[];
  /**
   * Diagnostics about the harness itself. These are our bug, never the user's,
   * so the caller reports them differently instead of blaming the solution.
   */
  harnessErrors: CompileError[];
}

/**
 * Parses javac output into structured diagnostics.
 *
 * The column comes from javac's caret line — it prints the offending source line
 * and then a `^` underneath — which is the only place the column appears at all
 * in the default output format.
 */
export function parseJavacOutput(output: string, solutionFile: string): ParsedDiagnostics {
  const lines = output.split(/\r?\n/);
  const errors: CompileError[] = [];
  const harnessErrors: CompileError[] = [];
  const solutionBase = path.basename(solutionFile);

  for (let i = 0; i < lines.length; i += 1) {
    const match = DIAGNOSTIC.exec(lines[i] ?? '');
    if (!match) continue;

    const [, file, lineText, severity, message] = match;
    const column = caretColumn(lines, i);
    const diagnostic: CompileError = {
      line: Number(lineText),
      ...(column !== undefined ? { column } : {}),
      message: message ?? '',
      severity: severity === 'warning' ? 'warning' : 'error',
    };

    if (file && path.basename(file) === solutionBase) {
      errors.push(diagnostic);
    } else {
      harnessErrors.push(diagnostic);
    }
  }

  return { errors, harnessErrors };
}

/**
 * Finds the caret line belonging to the diagnostic at `from` and returns the
 * 1-based column it points at. Gives up at the next diagnostic, so a message
 * with no source excerpt does not steal the following one's caret.
 */
function caretColumn(lines: readonly string[], from: number): number | undefined {
  for (let i = from + 1; i < Math.min(from + 4, lines.length); i += 1) {
    const line = lines[i];
    if (line === undefined) break;
    if (DIAGNOSTIC.test(line)) break;
    const caret = line.indexOf('^');
    if (caret !== -1 && line.slice(0, caret).trim() === '') {
      return caret + 1;
    }
  }
  return undefined;
}

/** A readable one-liner for the verdict banner when there is no structured error. */
export function summariseCompileFailure(output: string): string {
  const firstError = output.split(/\r?\n/).find((line) => DIAGNOSTIC.exec(line)?.[3] === 'error');
  if (firstError) {
    return DIAGNOSTIC.exec(firstError)?.[4] ?? firstError;
  }
  return output.trim().split(/\r?\n/).slice(0, 3).join('\n') || 'compilation failed';
}
