import type { JsonValue } from '@devpromax/shared';

/**
 * Comparing what the judge expected with what the code returned (ROADMAP P4-7).
 *
 * Two jobs, and they answer different questions. `formatValue` answers "what did
 * it produce" and has to survive a hidden test whose input is a hundred thousand
 * integers. `firstDifference` answers "where did it go wrong", which is the
 * question someone actually has when a Wrong Answer appears - scanning two
 * hundred-element arrays by eye for the one element that differs is the worst
 * part of using a judge, and it is entirely avoidable.
 */

/** Past this, a value is shown truncated. A revealed hidden test can be enormous. */
const MAX_CHARS = 6000;
/** Below this, a value reads better on one line than pretty-printed. */
const INLINE_CHARS = 90;

export interface FormattedValue {
  lines: string[];
  truncated: boolean;
}

export function formatValue(value: JsonValue | undefined): FormattedValue {
  if (value === undefined) return { lines: [], truncated: false };

  const compact = JSON.stringify(value);
  if (compact === undefined) return { lines: [], truncated: false };
  if (compact.length <= INLINE_CHARS) return { lines: [compact], truncated: false };

  // Pretty-printed puts one array element per line, which is what makes the
  // line-by-line comparison below line up with what the eye is doing.
  const pretty = JSON.stringify(value, null, 2) ?? compact;
  if (pretty.length <= MAX_CHARS) return { lines: pretty.split('\n'), truncated: false };

  const kept: string[] = [];
  let used = 0;
  for (const line of pretty.split('\n')) {
    if (used + line.length > MAX_CHARS) break;
    kept.push(line);
    used += line.length + 1;
  }
  return { lines: kept, truncated: true };
}

/**
 * Which lines of two formatted values differ.
 *
 * Positional rather than a real Myers diff: both sides are the same value
 * printed the same way, so line 7 of one is line 7 of the other unless something
 * is genuinely different there. A shortest-edit diff would spend its cleverness
 * re-aligning an array whose fourth element changed and report every later line
 * as unchanged-but-moved, which is not what happened.
 */
export function changedLines(expected: readonly string[], actual: readonly string[]): boolean[] {
  const length = Math.max(expected.length, actual.length);
  return Array.from({ length }, (_unused, index) => expected[index] !== actual[index]);
}

export interface ValueDifference {
  /** Where, in the reader's terms: `[4]`, `.count`, or `the value` at the root. */
  path: string;
  expected: string;
  actual: string;
}

function show(value: JsonValue | undefined): string {
  return value === undefined ? 'nothing' : (JSON.stringify(value) ?? 'nothing');
}

function isObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
  path: string,
): ValueDifference | null {
  if (expected === undefined || actual === undefined) {
    return expected === actual ? null : { path, expected: show(expected), actual: show(actual) };
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      const difference = walk(expected[index], actual[index], `${path}[${String(index)}]`);
      if (difference) return difference;
    }
    return null;
  }

  if (isObject(expected) && isObject(actual)) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
    for (const key of keys) {
      const difference = walk(expected[key], actual[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return null;
  }

  // `Object.is` so that a `NaN` round-tripped as `null` and a `-0` are compared
  // the way the comparators on the server compare them.
  if (Object.is(expected, actual)) return null;
  return { path, expected: show(expected), actual: show(actual) };
}

/**
 * The first place the two values part company, or `null` if they agree.
 *
 * Only the first: a solution that is off by one produces thousands of
 * differences and exactly one useful sentence.
 */
export function firstDifference(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
): ValueDifference | null {
  const difference = walk(expected, actual, '');
  if (!difference) return null;
  return { ...difference, path: difference.path === '' ? 'the value' : difference.path };
}
