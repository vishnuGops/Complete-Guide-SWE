import path from 'node:path';
import type { CompileError } from '@devpromax/shared';

/** `<path>:<line>: error: <message>` — javac's default diagnostic format. */
const DIAGNOSTIC = /^(.*?):(\d+): (error|warning): (.*)$/;

/** `duplicate class: <name>`, the one javac diagnostic the harness can cause. */
const DUPLICATE_CLASS = /^duplicate class:\s*([\w.$]+)/;

/**
 * Class names the workspace already contains (ROADMAP P2-11).
 *
 * Two kinds. `ListNode` and `TreeNode` are deliberately ours: the harness
 * defines them so a starter can say `ListNode head` without the user writing
 * the class, which means declaring a second one is a collision by design and
 * the message has to say so. The `DevProMax*` names are the harness's own
 * plumbing, renamed out of the way precisely so that this list is short - a user
 * who hits one of those has gone looking for it.
 */
const HARNESS_CLASSES: Record<string, string> = {
  ListNode:
    'the judge already defines `ListNode` for you - delete your own copy and use the provided one (it has `val` and `next`).',
  TreeNode:
    'the judge already defines `TreeNode` for you - delete your own copy and use the provided one (it has `val`, `left` and `right`).',
  DevProMaxMain: 'the judge reserves the class name `DevProMaxMain`. Rename your class.',
  DevProMaxJson: 'the judge reserves the class name `DevProMaxJson`. Rename your class.',
  DevProMaxConvert: 'the judge reserves the class name `DevProMaxConvert`. Rename your class.',
};

/**
 * Rewrites a collision with the harness into something the user can act on.
 *
 * Returns `undefined` for anything else, including a duplicate class the user
 * declared twice themselves - javac's own wording is already right for that.
 */
export function harnessCollisionMessage(message: string): string | undefined {
  const name = DUPLICATE_CLASS.exec(message)?.[1];
  return name === undefined ? undefined : HARNESS_CLASSES[name];
}

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
    const collision = harnessCollisionMessage(message ?? '');
    const diagnostic: CompileError = {
      line: Number(lineText),
      ...(column !== undefined ? { column } : {}),
      message: collision ?? message ?? '',
      severity: severity === 'warning' ? 'warning' : 'error',
    };

    if (file && path.basename(file) === solutionBase) {
      errors.push(diagnostic);
    } else if (collision !== undefined) {
      // Attributed to the harness file, but caused by the user's class. javac
      // reports a duplicate at its later definition and the harness is compiled
      // first, so this is the order javac would have to invert to produce -
      // handled anyway, because "the judge's harness failed to compile" is the
      // one answer that is certainly wrong. The line number is dropped: it
      // points into a file the user has never seen.
      const { line: _line, column: _column, ...rest } = diagnostic;
      errors.push(rest);
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

/**
 * What a user is told when the compiler itself ran out of time (ROADMAP P2-11).
 *
 * Its own message because the generic summary said "compilation failed", which
 * reads as "your code is wrong" for what is usually a machine doing something
 * else. Shared by both languages so they answer the same way - Python's syntax
 * check is a compile step too, whatever it is called.
 */
export function compileTimeoutMessage(timeoutMs: number): string {
  const seconds = (timeoutMs / 1000).toFixed(timeoutMs % 1000 === 0 ? 0 : 1);
  return `the compiler exceeded ${seconds}s and was stopped. Raise the time limit multiplier in Settings if this machine is busy.`;
}

/** A readable one-liner for the verdict banner when there is no structured error. */
export function summariseCompileFailure(output: string): string {
  const firstError = output.split(/\r?\n/).find((line) => DIAGNOSTIC.exec(line)?.[3] === 'error');
  if (firstError) {
    return DIAGNOSTIC.exec(firstError)?.[4] ?? firstError;
  }
  return output.trim().split(/\r?\n/).slice(0, 3).join('\n') || 'compilation failed';
}
