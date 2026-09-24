import { z } from 'zod';
import type { ExpectMode, JsonValue, TestMode } from '@devpromax/shared';

/**
 * The wire protocol between the judge and a language harness.
 *
 * Both harnesses (runner.py, DevProMaxMain.java) implement this, so the judge
 * core knows nothing about either language beyond how to start it. Results are
 * JSON Lines written to a file rather than to stdout, which means the user's own
 * `print` can never corrupt them and a killed process still leaves behind
 * everything it finished.
 */

export interface HarnessTest {
  index: number;
  args: unknown[];
  ops?: { method: string; args: unknown[] }[];
}

export interface HarnessPayload {
  mode: TestMode;
  entry: string;
  expect: ExpectMode;
  /** Per-test wall-clock budget the harness enforces itself. */
  timeoutMs: number;
  /** Absolute paths, so the harness never has to guess the layout. */
  solutionPath: string;
  resultsPath: string;
  /**
   * A chain argument to close into a cycle before calling (ROADMAP P2-15).
   *
   * Sent per run rather than per test because it is a fact about the problem:
   * which argument holds the values and which holds the position the tail links
   * back to. Absent for every problem that does not need one, which is all but
   * two of them.
   */
  cycle?: { chain: number; at: number };
  tests: HarnessTest[];
}

/** Exit codes a harness may use; anything else is an unexpected crash. */
export const HARNESS_EXIT = {
  ok: 0,
  loadFailed: 2,
  /** A per-test timeout fired; the remaining tests were abandoned. */
  timeout: 3,
  /**
   * The solution ended the process itself - Java's `System.exit` - and the
   * harness recorded that against the test that did it before going down
   * (ROADMAP P2-17). Like `timeout`, it means "the test in flight has its
   * record; the rest never ran".
   */
  abandoned: 4,
} as const;

const errorSchema = z.object({
  type: z.string().default('Error'),
  message: z.string().default(''),
  traceback: z.string().default(''),
});

/**
 * A returned value, taken as JSON gave it rather than walked by zod
 * (ROADMAP P2-19).
 *
 * `jsonValueSchema` is a recursive union, and a wrong subsets-style answer is a
 * hundred thousand values: zod spent ~56 ms proving that `JSON.parse` returned
 * JSON. The one thing JSON.parse can produce that a JsonValue cannot hold is a
 * non-finite number - a 400-digit integer overflows to Infinity - and
 * `firstNonFinite` looks for exactly that, without the union machinery.
 */
const jsonValue = z.custom<JsonValue>(() => true);

const testRecordSchema = z.object({
  index: z.int().min(0),
  status: z.enum(['ok', 'error', 'timeout']),
  timeMs: z.number().min(0).default(0),
  returned: jsonValue.optional(),
  mutatedArgs: z.array(z.object({ index: z.int().min(0), value: jsonValue })).optional(),
  error: errorSchema.optional(),
  stdout: z.string().default(''),
  stderr: z.string().default(''),
  outputTruncated: z.boolean().default(false),
});

/**
 * A failure that stopped the harness before any test could run: a syntax error
 * in the solution, or a missing entry class.
 */
const fatalRecordSchema = z.object({
  event: z.literal('fatal'),
  kind: z.enum(['compile', 'load']),
  message: z.string(),
  line: z.int().min(1).nullish(),
  column: z.int().min(1).nullish(),
  traceback: z.string().default(''),
  /**
   * Set by the judge, never by a harness: the solution was still loading when
   * the watchdog fired (ROADMAP P2-17), which is a time limit rather than a
   * crash.
   */
  timedOut: z.boolean().optional(),
});

/**
 * Written once the solution is loaded and its entry point found, before the
 * first test (ROADMAP P2-17).
 *
 * It is what lets the judge tell "the file never finished loading" - a loop at
 * module level, a static initialiser that throws or calls `System.exit` - from
 * "test 0 crashed". Without it both looked like a batch that stopped early, and
 * the isolation fallback re-ran the load failure once per test, each one paying
 * the full per-test budget.
 */
const readyRecordSchema = z.object({ event: z.literal('ready') });

export const harnessRecordSchema = z.union([fatalRecordSchema, testRecordSchema]);
export type HarnessTestRecord = z.infer<typeof testRecordSchema>;
export type HarnessFatalRecord = z.infer<typeof fatalRecordSchema>;
export type HarnessRecord = z.infer<typeof harnessRecordSchema>;

export function isFatal(record: HarnessRecord): record is HarnessFatalRecord {
  return 'event' in record && record.event === 'fatal';
}

export interface ParsedResults {
  records: HarnessRecord[];
  /** The harness got past loading the solution (see `readyRecordSchema`). */
  ready: boolean;
}

/**
 * Parses a JSON Lines result file.
 *
 * A trailing partial line is dropped rather than throwing: the process may have
 * been killed mid-write, and the completed records above it are still good.
 *
 * A complete line that is not a valid record is *not* dropped when it names a
 * test (ROADMAP P2-19). It used to be, and a test whose record vanished looked
 * exactly like a test the harness never reached - so the judge re-ran it in
 * isolation, got the same unreadable line, and reported a crash that never
 * happened. It becomes an error record for that test instead, saying what was
 * wrong with it.
 */
export function parseResults(contents: string): ParsedResults {
  const records: HarnessRecord[] = [];
  let ready = false;
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (readyRecordSchema.safeParse(parsed).success) {
      ready = true;
      continue;
    }

    const result = harnessRecordSchema.safeParse(parsed);
    if (!result.success) {
      const unreadable = unreadableRecord(parsed, describeTestRecordIssue(parsed));
      if (unreadable) records.push(unreadable);
      continue;
    }

    const record = result.data;
    if (!isFatal(record)) {
      const bad = nonFiniteIn(record);
      if (bad) {
        records.push(unreadableRecord(parsed, bad) ?? record);
        continue;
      }
    }
    records.push(record);
  }
  return { records, ready };
}

/** The records alone, for callers that do not care whether loading finished. */
export function parseResultLines(contents: string): HarnessRecord[] {
  return parseResults(contents).records;
}

function nonFiniteIn(record: HarnessTestRecord): string | undefined {
  if (record.returned !== undefined && firstNonFinite(record.returned)) {
    return 'the returned value holds a number too large for the judge to represent';
  }
  for (const arg of record.mutatedArgs ?? []) {
    if (firstNonFinite(arg.value)) {
      return `argument ${arg.index} holds a number too large for the judge to represent`;
    }
  }
  return undefined;
}

/**
 * True when the value holds a number JSON cannot express.
 *
 * Iterative, because the value is whatever the solution returned: a deeply
 * nested list must not be able to overflow the judge's own stack.
 */
export function firstNonFinite(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const next = stack.pop();
    if (typeof next === 'number') {
      if (!Number.isFinite(next)) return true;
    } else if (Array.isArray(next)) {
      for (const item of next) stack.push(item);
    } else if (next !== null && typeof next === 'object') {
      for (const item of Object.values(next)) stack.push(item);
    }
  }
  return false;
}

/**
 * What is wrong with a line as a *test* record. The union's own error only says
 * that neither branch matched, which names nothing a reader could act on.
 */
function describeTestRecordIssue(parsed: unknown): string {
  const issue = testRecordSchema.safeParse(parsed).error?.issues[0];
  if (!issue) return 'the record is malformed';
  const where = issue.path.map(String).join('.');
  return where ? `${where}: ${issue.message}` : issue.message;
}

/** An error record for a line that names a test but cannot be used as its result. */
function unreadableRecord(parsed: unknown, reason: string): HarnessTestRecord | undefined {
  if (parsed === null || typeof parsed !== 'object') return undefined;
  const raw = parsed as { index?: unknown; timeMs?: unknown };
  if (typeof raw.index !== 'number' || !Number.isInteger(raw.index) || raw.index < 0) {
    return undefined;
  }
  return {
    index: raw.index,
    status: 'error',
    timeMs: typeof raw.timeMs === 'number' && Number.isFinite(raw.timeMs) ? raw.timeMs : 0,
    stdout: '',
    stderr: '',
    outputTruncated: false,
    error: {
      type: 'UnreadableResult',
      message: `the judge could not read this test's result: ${reason}`,
      traceback: '',
    },
  };
}
