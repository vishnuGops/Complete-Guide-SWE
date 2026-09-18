import { z } from 'zod';
import {
  jsonValueSchema,
  mutatedArgSchema,
  type ExpectMode,
  type TestMode,
} from '@devpromax/shared';

/**
 * The wire protocol between the judge and a language harness.
 *
 * Both harnesses (runner.py, Main.java) implement this, so the judge core knows
 * nothing about either language beyond how to start it. Results are JSON Lines
 * written to a file rather than to stdout, which means the user's own `print`
 * can never corrupt them and a killed process still leaves behind everything it
 * finished.
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
} as const;

const errorSchema = z.object({
  type: z.string().default('Error'),
  message: z.string().default(''),
  traceback: z.string().default(''),
});

const testRecordSchema = z.object({
  index: z.int().min(0),
  status: z.enum(['ok', 'error', 'timeout']),
  timeMs: z.number().min(0).default(0),
  returned: jsonValueSchema.optional(),
  mutatedArgs: z.array(mutatedArgSchema).optional(),
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
});

export const harnessRecordSchema = z.union([fatalRecordSchema, testRecordSchema]);
export type HarnessTestRecord = z.infer<typeof testRecordSchema>;
export type HarnessFatalRecord = z.infer<typeof fatalRecordSchema>;
export type HarnessRecord = z.infer<typeof harnessRecordSchema>;

export function isFatal(record: HarnessRecord): record is HarnessFatalRecord {
  return 'event' in record && record.event === 'fatal';
}

/**
 * Parses a JSON Lines result file.
 *
 * A trailing partial line is dropped rather than throwing: the process may have
 * been killed mid-write, and the completed records above it are still good.
 */
export function parseResultLines(contents: string): HarnessRecord[] {
  const records: HarnessRecord[] = [];
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const result = harnessRecordSchema.safeParse(parsed);
    if (result.success) records.push(result.data);
  }
  return records;
}
