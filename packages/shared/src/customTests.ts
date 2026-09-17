import { jsonValueSchema, type JsonValue } from './json.js';
import type { Operation, ProblemMeta, TestCase, TestsFile } from './problem.js';

/**
 * Parsing the custom test cases a user types into the Run panel (ROADMAP P2-6).
 *
 * Lives in `shared` rather than on the server because both sides need the same
 * answer: the editor marks a bad argument as the user types, and the server must
 * not trust that it did. One parser means the message shown while typing is the
 * message the server would have given.
 *
 * A custom case carries input and no expectation. There is nothing to be wrong
 * about: Run with custom input answers "what does my code do with this", which
 * is a different question from "is my code correct", and the judge reports the
 * value rather than a verdict.
 */

/** The maximum a user may add in one Run, matching `runRequestSchema`. */
export const MAX_CUSTOM_TESTS = 20;

export interface CustomTestShape {
  mode: ProblemMeta['mode'];
  /**
   * How many JSON values the user supplies: the entry method's arguments in
   * `function` mode, the constructor's in `operations` mode.
   *
   * Taken from the problem's own sample tests rather than from metadata or by
   * parsing a starter. The samples are what the harness actually calls the
   * solution with, so they cannot disagree with the signature the way a
   * hand-maintained arity field eventually would.
   */
  argCount: number;
  /** `operations` mode: the methods the problem's own tests use. */
  methods: string[];
  /** The first sample's arguments as JSON text, to prefill the editor. */
  example: string[];
}

export function customTestShape(meta: ProblemMeta, tests: TestsFile): CustomTestShape {
  return customTestShapeFrom(meta.mode, tests.samples);
}

/**
 * The same derivation from the two things it actually reads.
 *
 * The web app never sees a `ProblemMeta` or a `TestsFile` - `ProblemDetail`
 * carries the mode and the samples and deliberately withholds the rest - but the
 * Run panel has to mark a bad argument with the same message the server would
 * give. Taking the mode and the samples rather than the files they came from is
 * what lets both callers reach one implementation (ROADMAP P4-6).
 */
export function customTestShapeFrom(
  mode: ProblemMeta['mode'],
  samples: readonly TestCase[],
): CustomTestShape {
  const sample = samples[0];
  const methods =
    mode === 'operations'
      ? [...new Set(samples.flatMap((test) => (test.ops ?? []).map((op) => op.method)))].sort()
      : [];

  return {
    mode,
    argCount: sample?.args.length ?? 0,
    methods,
    example: (sample?.args ?? []).map((arg) => JSON.stringify(arg)),
  };
}

/** What the user typed: one JSON value per argument, plus the ops list if any. */
export interface CustomTestInput {
  args: readonly string[];
  /**
   * `operations` mode only: a JSON array of `[method, args]` pairs, the same
   * wire format the problem's own tests use.
   */
  ops?: string;
}

export interface CustomTestIssue {
  /** Which argument box to mark, or absent when the issue is about the case as a whole. */
  argIndex?: number;
  message: string;
}

export type CustomTestParse =
  { ok: true; test: TestCase } | { ok: false; issues: CustomTestIssue[] };

/**
 * Checks an already-parsed case against the problem's shape.
 *
 * The wire format carries `TestCase` objects, not the strings the user typed, so
 * this is the check the server runs on arrival: the editor having validated the
 * same case a moment earlier proves nothing about what actually arrived.
 */
export function checkCustomTest(test: TestCase, shape: CustomTestShape): CustomTestIssue[] {
  const issues: CustomTestIssue[] = [];

  if (test.args.length !== shape.argCount) {
    issues.push({
      message: `expected ${shape.argCount} argument${shape.argCount === 1 ? '' : 's'}, got ${test.args.length}`,
    });
  }

  if (test.expected !== undefined || test.expectedMutatedArgs !== undefined) {
    // A custom case is input only. Accepting an expectation from the client
    // would let the page decide what counts as correct.
    issues.push({ message: 'a custom case cannot carry its own expected output' });
  }

  if (shape.mode === 'operations') {
    const ops = test.ops ?? [];
    if (ops.length === 0) {
      issues.push({ message: 'this problem needs a list of calls to make' });
    }
    for (const [index, op] of ops.entries()) {
      if (shape.methods.length > 0 && !shape.methods.includes(op.method)) {
        issues.push({
          message: `call ${index + 1}: this problem has no method "${op.method}" (try ${shape.methods.join(', ')})`,
        });
      }
    }
  } else if (test.ops !== undefined) {
    issues.push({ message: 'this problem is not an operations problem, so it takes no call list' });
  }

  return issues;
}

export function parseCustomTest(input: CustomTestInput, shape: CustomTestShape): CustomTestParse {
  const issues: CustomTestIssue[] = [];

  if (input.args.length !== shape.argCount) {
    issues.push({
      message: `expected ${shape.argCount} argument${shape.argCount === 1 ? '' : 's'}, got ${input.args.length}`,
    });
    return { ok: false, issues };
  }

  const args: JsonValue[] = [];
  for (const [index, raw] of input.args.entries()) {
    const parsed = parseJsonValue(raw);
    if (!parsed.ok) {
      issues.push({ argIndex: index, message: parsed.message });
      continue;
    }
    args.push(parsed.value);
  }

  if (shape.mode === 'operations') {
    const ops = parseOps(input.ops, shape);
    if (!ops.ok) issues.push(...ops.issues);
    else if (issues.length === 0) return { ok: true, test: { args, ops: ops.value } };
  } else if (input.ops !== undefined && input.ops.trim() !== '') {
    issues.push({ message: 'this problem is not an operations problem, so it takes no call list' });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, test: { args } };
}

/** Parses a whole panel of custom cases, reporting which case each issue is in. */
export function parseCustomTests(
  inputs: readonly CustomTestInput[],
  shape: CustomTestShape,
): { ok: true; tests: TestCase[] } | { ok: false; issues: (CustomTestIssue & { case: number })[] } {
  if (inputs.length > MAX_CUSTOM_TESTS) {
    return {
      ok: false,
      issues: [{ case: MAX_CUSTOM_TESTS, message: `at most ${MAX_CUSTOM_TESTS} custom cases` }],
    };
  }

  const tests: TestCase[] = [];
  const issues: (CustomTestIssue & { case: number })[] = [];

  for (const [index, input] of inputs.entries()) {
    const parsed = parseCustomTest(input, shape);
    if (parsed.ok) tests.push(parsed.test);
    else issues.push(...parsed.issues.map((issue) => ({ ...issue, case: index })));
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, tests };
}

function parseJsonValue(
  raw: string,
): { ok: true; value: JsonValue } | { ok: false; message: string } {
  if (raw.trim() === '') return { ok: false, message: 'is empty' };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    // JSON.parse's own message names the position, which is more useful than
    // anything we could say instead.
    return { ok: false, message: `is not valid JSON: ${(error as Error).message}` };
  }

  const checked = jsonValueSchema.safeParse(value);
  if (!checked.success) return { ok: false, message: 'is not a value the judge can send' };
  return { ok: true, value: checked.data };
}

function parseOps(
  raw: string | undefined,
  shape: CustomTestShape,
): { ok: true; value: Operation[] } | { ok: false; issues: CustomTestIssue[] } {
  if (raw === undefined || raw.trim() === '') {
    return { ok: false, issues: [{ message: 'this problem needs a list of calls to make' }] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      issues: [{ message: `the call list is not valid JSON: ${(error as Error).message}` }],
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      issues: [{ message: 'the call list must be an array of [method, args] pairs' }],
    };
  }

  const ops: Operation[] = [];
  const issues: CustomTestIssue[] = [];

  for (const [index, entry] of parsed.entries()) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      issues.push({ message: `call ${index + 1} must be a [method, args] pair` });
      continue;
    }
    const [method, args] = entry as [unknown, unknown];
    if (typeof method !== 'string' || method === '') {
      issues.push({ message: `call ${index + 1} must name a method` });
      continue;
    }
    if (!Array.isArray(args)) {
      issues.push({ message: `call ${index + 1}: the arguments of ${method} must be an array` });
      continue;
    }
    // Restricting to methods the problem's own tests use is what keeps a typo
    // from reaching the harness as a mystery AttributeError three seconds later.
    if (shape.methods.length > 0 && !shape.methods.includes(method)) {
      issues.push({
        message: `call ${index + 1}: this problem has no method "${method}" (try ${shape.methods.join(', ')})`,
      });
      continue;
    }
    const checked = jsonValueSchema.array().safeParse(args);
    if (!checked.success) {
      issues.push({
        message: `call ${index + 1}: the arguments of ${method} are not values the judge can send`,
      });
      continue;
    }
    ops.push({ method, args: checked.data });
  }

  if (ops.length === 0 && issues.length === 0) {
    issues.push({ message: 'the call list is empty, so there is nothing to run' });
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: ops };
}
