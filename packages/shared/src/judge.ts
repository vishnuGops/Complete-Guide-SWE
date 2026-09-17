import { z } from 'zod';
import { jsonValueSchema } from './json.js';
import { languageSchema } from './language.js';
import { mutatedArgSchema, slugSchema, testCaseSchema } from './problem.js';

/**
 * Judge verdicts.
 *
 * `MLE` is reported for Java only: the JVM is started with `-Xmx`, so an
 * OutOfMemoryError is an unambiguous memory verdict. CPython has no equivalent
 * hard cap here, so Python memory exhaustion surfaces as `RE` rather than
 * pretending to a limit we do not enforce (ROADMAP P0-7).
 */
export const VERDICTS = ['AC', 'WA', 'TLE', 'RE', 'CE', 'MLE'] as const;
export const verdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof verdictSchema>;

export const VERDICT_LABEL: Record<Verdict, string> = {
  AC: 'Accepted',
  WA: 'Wrong Answer',
  TLE: 'Time Limit Exceeded',
  RE: 'Runtime Error',
  CE: 'Compile Error',
  MLE: 'Memory Limit Exceeded',
};

/**
 * Worst-first order. A run's verdict is the worst verdict among its tests, so
 * that one TLE inside a batch of WAs is not hidden.
 */
const VERDICT_SEVERITY: Record<Verdict, number> = {
  CE: 5,
  MLE: 4,
  RE: 3,
  TLE: 2,
  WA: 1,
  AC: 0,
};

export function worstVerdict(verdicts: readonly Verdict[]): Verdict {
  let worst: Verdict = 'AC';
  for (const v of verdicts) {
    if (VERDICT_SEVERITY[v] > VERDICT_SEVERITY[worst]) worst = v;
  }
  return worst;
}

export function isAccepted(verdict: Verdict): boolean {
  return verdict === 'AC';
}

// ---------------------------------------------------------------------------
// Compile diagnostics
// ---------------------------------------------------------------------------

/** Parsed `javac` diagnostic, mapped onto Monaco markers by the UI. */
export const compileErrorSchema = z.object({
  line: z.int().min(1).optional(),
  column: z.int().min(1).optional(),
  message: z.string(),
  severity: z.enum(['error', 'warning']).default('error'),
});
export type CompileError = z.infer<typeof compileErrorSchema>;

// ---------------------------------------------------------------------------
// Per-test results
// ---------------------------------------------------------------------------

/** Which pool a test came from; hidden inputs stay hidden unless revealed. */
export const TEST_SOURCES = ['sample', 'hidden', 'custom'] as const;
export const testSourceSchema = z.enum(TEST_SOURCES);
export type TestSource = z.infer<typeof testSourceSchema>;

export const testResultSchema = z.object({
  index: z.int().min(0),
  source: testSourceSchema,
  name: z.string().optional(),
  verdict: verdictSchema,
  timeMs: z.number().min(0),
  /**
   * Input, expected and actual are omitted for hidden tests unless this is the
   * first failing hidden test, which P2-6 reveals.
   */
  revealed: z.boolean().default(true),
  input: testCaseSchema.optional(),
  expected: jsonValueSchema.optional(),
  actual: jsonValueSchema.optional(),
  expectedMutatedArgs: z.array(mutatedArgSchema).optional(),
  actualMutatedArgs: z.array(mutatedArgSchema).optional(),
  stdout: z.string().default(''),
  stderr: z.string().default(''),
  /** Comparator explanation, or a runtime traceback for RE. */
  message: z.string().optional(),
});
export type TestResult = z.infer<typeof testResultSchema>;

// ---------------------------------------------------------------------------
// Requests and results
// ---------------------------------------------------------------------------

export const RUN_KINDS = ['run', 'submit'] as const;
export const runKindSchema = z.enum(RUN_KINDS);
export type RunKind = z.infer<typeof runKindSchema>;

/** 256 KB of source is far beyond any interview answer and bounds the judge. */
export const MAX_CODE_BYTES = 256 * 1024;

export const runRequestSchema = z.object({
  slug: slugSchema,
  language: languageSchema,
  code: z.string().max(MAX_CODE_BYTES),
  /** `run` = samples + custom cases; `submit` = samples + hidden (ROADMAP P2-6). */
  kind: runKindSchema,
  /** Only honoured for `kind: 'run'`; ignored on submit. */
  customTests: z.array(testCaseSchema).max(20).optional(),
});
export type RunRequest = z.infer<typeof runRequestSchema>;

export const runResultSchema = z.object({
  slug: slugSchema,
  language: languageSchema,
  kind: runKindSchema,
  /** The problem version the tests came from, recorded with submissions. */
  problemVersion: z.int().min(1),
  verdict: verdictSchema,
  passed: z.int().min(0),
  total: z.int().min(0),
  /** Wall-clock for the whole run, including compilation. */
  totalTimeMs: z.number().min(0),
  compileTimeMs: z.number().min(0).optional(),
  compileErrors: z.array(compileErrorSchema).default([]),
  tests: z.array(testResultSchema),
  /** True when stdout/stderr hit OUTPUT_CAP_BYTES and was cut. */
  outputTruncated: z.boolean().default(false),
  /**
   * True when a per-test timeout forced the judge to abandon batch execution
   * and re-run the remaining tests one process each (ROADMAP D3).
   */
  isolationFallback: z.boolean().default(false),
});
export type RunResult = z.infer<typeof runResultSchema>;
