import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CheckerFn, Comparator, JsonValue, TestCase } from '@devpromax/shared';

export interface CompareResult {
  pass: boolean;
  /** Shown to the user, so it must say what was wrong, not just "incorrect". */
  message?: string;
}

const PASS: CompareResult = { pass: true };

// ---------------------------------------------------------------------------
// Rendering values for messages
// ---------------------------------------------------------------------------

const PREVIEW_LIMIT = 200;

/** Compact JSON for an error message, elided in the middle when long. */
export function preview(value: JsonValue | undefined): string {
  if (value === undefined) return '(nothing)';
  const text = JSON.stringify(value);
  if (text === undefined) return String(value);
  if (text.length <= PREVIEW_LIMIT) return text;
  const head = text.slice(0, PREVIEW_LIMIT - 40);
  const tail = text.slice(-30);
  return `${head} … ${tail} (${text.length} chars)`;
}

function typeName(value: JsonValue | undefined): string {
  if (value === undefined) return 'nothing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// ---------------------------------------------------------------------------
// exact
// ---------------------------------------------------------------------------

/**
 * Deep structural equality over JSON values.
 *
 * `-0` and `0` compare equal: they are the same number, and a solution that
 * happens to produce a negative zero has not made a mistake. `NaN` cannot reach
 * here — it has no JSON encoding and both harnesses reject it at serialisation
 * time, so an infinite or undefined result surfaces as a runtime error rather
 * than as a mysterious wrong answer.
 */
export function deepEquals(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEquals(item, b[i]));
  }

  if (typeof a === 'object' || typeof b === 'object') {
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b).sort();
    if (aKeys.length !== bKeys.length) return false;
    if (!aKeys.every((k, i) => k === bKeys[i])) return false;
    return aKeys.every((k) => deepEquals(a[k], b[k]));
  }

  return false;
}

/** Where two values first differ, as a JSON-ish path, for the message. */
function firstDifference(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
  at = '',
): string | undefined {
  if (deepEquals(expected, actual)) return undefined;

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      return `${at || 'the result'} has length ${actual.length}, expected ${expected.length}`;
    }
    for (let i = 0; i < expected.length; i += 1) {
      const nested = firstDifference(expected[i], actual[i], `${at}[${i}]`);
      if (nested) return nested;
    }
    return undefined;
  }

  const where = at || 'the result';
  if (typeName(expected) !== typeName(actual)) {
    return `${where} is ${typeName(actual)}, expected ${typeName(expected)}`;
  }
  return `${where} is ${preview(actual)}, expected ${preview(expected)}`;
}

// ---------------------------------------------------------------------------
// unordered
// ---------------------------------------------------------------------------

/**
 * Multiset comparison: every expected element must be matched by a distinct
 * actual element. Greedy matching is exact here because `equals` is an
 * equivalence relation, so any successful pairing is as good as any other.
 */
function multisetEquals(
  expected: readonly JsonValue[],
  actual: readonly JsonValue[],
  equals: (a: JsonValue, b: JsonValue) => boolean,
): { pass: true } | { pass: false; missing: JsonValue } {
  const used = new Array<boolean>(actual.length).fill(false);
  for (const want of expected) {
    const index = actual.findIndex((got, i) => !used[i] && equals(want, got));
    if (index === -1) return { pass: false, missing: want };
    used[index] = true;
  }
  return { pass: true };
}

function requireArrays(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
  kind: string,
): CompareResult | undefined {
  if (!Array.isArray(expected)) {
    return {
      pass: false,
      message: `the ${kind} comparator needs a list as the expected value, but the test declares ${typeName(expected)}`,
    };
  }
  if (!Array.isArray(actual)) {
    return {
      pass: false,
      message: `expected a list of ${expected.length} item(s), got ${typeName(actual)}: ${preview(actual)}`,
    };
  }
  if (expected.length !== actual.length) {
    return {
      pass: false,
      message: `expected ${expected.length} item(s), got ${actual.length}: ${preview(actual)}`,
    };
  }
  return undefined;
}

export function compareUnorderedList(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
): CompareResult {
  const bad = requireArrays(expected, actual, 'unorderedList');
  if (bad) return bad;
  const result = multisetEquals(expected as JsonValue[], actual as JsonValue[], deepEquals);
  if (result.pass) return PASS;
  return {
    pass: false,
    message: `missing ${preview(result.missing)}; order does not matter but the contents must match`,
  };
}

export function compareUnorderedListOfLists(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
): CompareResult {
  const bad = requireArrays(expected, actual, 'unorderedListOfLists');
  if (bad) return bad;

  const innerEquals = (a: JsonValue, b: JsonValue): boolean => {
    if (!Array.isArray(a) || !Array.isArray(b)) return deepEquals(a, b);
    if (a.length !== b.length) return false;
    return multisetEquals(a, b, deepEquals).pass;
  };

  const result = multisetEquals(expected as JsonValue[], actual as JsonValue[], innerEquals);
  if (result.pass) return PASS;
  return {
    pass: false,
    message: `missing ${preview(result.missing)}; neither the outer nor the inner order matters, but the contents must match`,
  };
}

// ---------------------------------------------------------------------------
// floatTolerance
// ---------------------------------------------------------------------------

/**
 * Two numbers are close enough when they are within `eps` absolutely **or**
 * within `eps` relative to the larger magnitude. The absolute arm keeps values
 * near zero from being impossible to match; the relative arm keeps large
 * answers from demanding more precision than a double carries.
 */
export function numbersClose(expected: number, actual: number, eps: number): boolean {
  if (expected === actual) return true;
  if (!Number.isFinite(actual)) return false;
  const diff = Math.abs(expected - actual);
  if (diff <= eps) return true;
  const scale = Math.max(Math.abs(expected), Math.abs(actual));
  return diff <= eps * scale;
}

export function compareWithTolerance(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
  eps: number,
): CompareResult {
  const walk = (
    want: JsonValue | undefined,
    got: JsonValue | undefined,
    at: string,
  ): string | undefined => {
    const where = at || 'the result';
    if (typeof want === 'number') {
      if (typeof got !== 'number') return `${where} is ${typeName(got)}, expected a number`;
      return numbersClose(want, got, eps)
        ? undefined
        : `${where} is ${got}, expected ${want} (tolerance ${eps})`;
    }
    if (Array.isArray(want)) {
      if (!Array.isArray(got)) return `${where} is ${typeName(got)}, expected a list`;
      if (want.length !== got.length) {
        return `${where} has length ${got.length}, expected ${want.length}`;
      }
      for (let i = 0; i < want.length; i += 1) {
        const nested = walk(want[i], got[i], `${at}[${i}]`);
        if (nested) return nested;
      }
      return undefined;
    }
    if (want !== null && typeof want === 'object') {
      if (got === null || typeof got !== 'object' || Array.isArray(got)) {
        return `${where} is ${typeName(got)}, expected an object`;
      }
      const wantKeys = Object.keys(want).sort();
      const gotKeys = Object.keys(got).sort();
      if (wantKeys.length !== gotKeys.length || !wantKeys.every((k, i) => k === gotKeys[i])) {
        return `${where} has keys ${preview(gotKeys)}, expected ${preview(wantKeys)}`;
      }
      for (const key of wantKeys) {
        const nested = walk(want[key], got[key], `${at}.${key}`);
        if (nested) return nested;
      }
      return undefined;
    }
    return deepEquals(want, got)
      ? undefined
      : `${where} is ${preview(got)}, expected ${preview(want)}`;
  };

  const problem = walk(expected, actual, '');
  return problem ? { pass: false, message: problem } : PASS;
}

// ---------------------------------------------------------------------------
// checker
// ---------------------------------------------------------------------------

const checkerCache = new Map<string, CheckerFn>();

/**
 * Loads a problem's `checker.ts` once per path and caches it.
 *
 * This is our TypeScript, not user code, so it runs in-process (D6). Node strips
 * the types on import, which means a checker may only use erasable syntax: no
 * enums, no namespaces, no parameter properties.
 */
export async function loadChecker(checkerPath: string): Promise<CheckerFn> {
  const key = path.resolve(checkerPath);
  const cached = checkerCache.get(key);
  if (cached) return cached;

  const module = (await import(pathToFileURL(key).href)) as { default?: unknown };
  const fn = module.default;
  if (typeof fn !== 'function') {
    throw new Error(`${checkerPath} must export a checker function as its default export`);
  }
  const checker = fn as CheckerFn;
  checkerCache.set(key, checker);
  return checker;
}

/** Test seam: forget cached checkers so a rewritten file is picked up. */
export function clearCheckerCache(): void {
  checkerCache.clear();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface CompareOptions {
  comparator: Comparator;
  /** The test as authored; a checker may need the input to re-derive the answer. */
  test: TestCase;
  /** Required when the comparator is `checker`. */
  checker?: CheckerFn;
}

export async function compareValues(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
  options: CompareOptions,
): Promise<CompareResult> {
  const { comparator } = options;

  switch (comparator.kind) {
    case 'exact': {
      if (deepEquals(expected, actual)) return PASS;
      return { pass: false, ...(messageFor(expected, actual) ?? {}) };
    }
    case 'unorderedList':
      return compareUnorderedList(expected, actual);
    case 'unorderedListOfLists':
      return compareUnorderedListOfLists(expected, actual);
    case 'floatTolerance':
      return compareWithTolerance(expected, actual, comparator.eps);
    case 'checker': {
      if (!options.checker) {
        throw new Error('comparator is "checker" but no checker was loaded for this problem');
      }
      const result = await options.checker({ input: options.test, expected, actual });
      return result.pass
        ? { pass: true, ...(result.message ? { message: result.message } : {}) }
        : result;
    }
    default: {
      // Unreachable for a comparator that came through the schema, which is the
      // point: reaching it means something handed the judge a raw meta.json
      // without parsing it, and a silent `undefined` here would surface much
      // later as an unreadable crash.
      const unknown: never = comparator;
      throw new Error(
        `unknown comparator ${JSON.stringify(unknown)}; problem metadata must be parsed with problemMetaSchema`,
      );
    }
  }
}

function messageFor(
  expected: JsonValue | undefined,
  actual: JsonValue | undefined,
): { message: string } | undefined {
  const diff = firstDifference(expected, actual);
  return diff ? { message: diff } : undefined;
}
