import { z } from 'zod';
import { jsonValueSchema, type JsonValue } from './json.js';
import { languageSchema, type Language } from './language.js';
import { ratingSchema, tierForRating, tierSchema, topicSchema } from './curriculum.js';

export const slugSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be lowercase kebab-case');

/**
 * `id` is the stable identity of a problem and must never change; `slug` is the
 * URL and directory name and may be renamed. Submissions reference the id.
 */
export const problemIdSchema = slugSchema;

// ---------------------------------------------------------------------------
// Test and expectation modes (ROADMAP D4)
// ---------------------------------------------------------------------------

export const TEST_MODES = ['function', 'operations'] as const;
export const testModeSchema = z.enum(TEST_MODES);
export type TestMode = z.infer<typeof testModeSchema>;

export const EXPECT_MODES = ['return', 'mutatedArgs', 'both'] as const;
export const expectModeSchema = z.enum(EXPECT_MODES);
export type ExpectMode = z.infer<typeof expectModeSchema>;

export function expectsReturn(expect: ExpectMode): boolean {
  return expect === 'return' || expect === 'both';
}

export function expectsMutatedArgs(expect: ExpectMode): boolean {
  return expect === 'mutatedArgs' || expect === 'both';
}

// ---------------------------------------------------------------------------
// Comparators (ROADMAP D6)
// ---------------------------------------------------------------------------

export const COMPARATOR_KINDS = [
  'exact',
  'unorderedList',
  'unorderedListOfLists',
  'floatTolerance',
  'checker',
] as const;
export type ComparatorKind = (typeof COMPARATOR_KINDS)[number];

/** Kinds that take no options, and so may be written as a bare string in meta.json. */
export const SIMPLE_COMPARATOR_KINDS = [
  'exact',
  'unorderedList',
  'unorderedListOfLists',
  'checker',
] as const;

const comparatorObjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('exact') }),
  z.object({ kind: z.literal('unorderedList') }),
  z.object({ kind: z.literal('unorderedListOfLists') }),
  z.object({ kind: z.literal('floatTolerance'), eps: z.number().positive() }),
  z.object({ kind: z.literal('checker') }),
]);

/**
 * Accepts either the object form or, for option-less kinds, the string shorthand
 * (`"comparator": "exact"`). ~200 hand-authored meta.json files is enough to pay
 * for the shorthand; `floatTolerance` still has to spell out its `eps`.
 */
export const comparatorSchema = z.union([
  z.enum(SIMPLE_COMPARATOR_KINDS).transform((kind) => ({ kind })),
  comparatorObjectSchema,
]);
export type Comparator = z.infer<typeof comparatorObjectSchema>;

export const DEFAULT_COMPARATOR: Comparator = { kind: 'exact' };

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

/** One `[method, args]` call in `operations` mode. */
export const operationSchema = z.strictObject({
  method: z.string().min(1),
  args: z.array(jsonValueSchema).default([]),
});
export type Operation = z.infer<typeof operationSchema>;

/**
 * An argument the solution is expected to mutate in place.
 *
 * Addressed by position rather than by a parallel array, because `null` is a
 * legal JSON value and a sparse parallel array could not distinguish "expected
 * to become null" from "not checked".
 */
export const mutatedArgSchema = z.strictObject({
  index: z.int().min(0),
  value: jsonValueSchema,
});
export type MutatedArg = z.infer<typeof mutatedArgSchema>;

export const testCaseSchema = z.strictObject({
  /** Optional author-facing label, surfaced in results ("empty input"). */
  name: z.string().min(1).optional(),
  /**
   * `function` mode: the method arguments.
   * `operations` mode: the constructor arguments.
   */
  args: z.array(jsonValueSchema),
  /** `operations` mode only: the calls applied after construction. */
  ops: z.array(operationSchema).optional(),
  /**
   * `function` mode: the return value.
   * `operations` mode: one entry per op, `null` for void methods.
   */
  expected: jsonValueSchema.optional(),
  /** Required when the problem's expect mode is `mutatedArgs` or `both`. */
  expectedMutatedArgs: z.array(mutatedArgSchema).optional(),
  /** Required on samples (shown in the statement), optional on hidden tests. */
  explanation: z.string().min(1).optional(),
});
export type TestCase = z.infer<typeof testCaseSchema>;

export const MIN_SAMPLE_TESTS = 3;
export const MIN_HIDDEN_TESTS = 10;

export const testsFileSchema = z.strictObject({
  /** Optional pointer to docs/schema/tests.schema.json, for editor completion. */
  $schema: z.string().optional(),
  samples: z.array(testCaseSchema),
  hidden: z.array(testCaseSchema),
});
export type TestsFile = z.infer<typeof testsFileSchema>;

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Per-test wall-clock budget. Python gets 2x Java (ROADMAP P1-1, P2-5). */
export const DEFAULT_TIMEOUT_MS: Record<Language, number> = {
  java: 2_000,
  python: 4_000,
};

/** Compilation happens once per run, not per test. */
export const DEFAULT_COMPILE_TIMEOUT_MS = 20_000;

/** Combined stdout+stderr kept per run before truncation (ROADMAP P2-5). */
export const OUTPUT_CAP_BYTES = 64 * 1024;

export const limitsSchema = z
  .object({
    timeoutMs: z.partialRecord(languageSchema, z.int().min(100).max(60_000)).optional(),
  })
  .default({});
export type Limits = z.infer<typeof limitsSchema>;

export function timeoutFor(limits: Limits | undefined, language: Language): number {
  return limits?.timeoutMs?.[language] ?? DEFAULT_TIMEOUT_MS[language];
}

// ---------------------------------------------------------------------------
// Problem metadata (meta.json)
// ---------------------------------------------------------------------------

const problemMetaBase = z.strictObject({
  /** Optional pointer to docs/schema/meta.schema.json, for editor completion. */
  $schema: z.string().optional(),
  id: problemIdSchema,
  slug: slugSchema,
  title: z.string().min(3).max(120),
  /** Bumped whenever tests change, so older submissions stay interpretable. */
  version: z.int().min(1),
  topic: topicSchema,
  /** e.g. ["two pointers", "sliding window"] - free text, used for search. */
  patterns: z.array(z.string().min(2)).min(1),
  tier: tierSchema,
  rating: ratingSchema,
  /** Position within the topic's learning path. */
  order: z.int().min(0),
  comparator: comparatorSchema.default(DEFAULT_COMPARATOR),
  limits: limitsSchema,
  /** Slugs of related problems, shown in the workspace. */
  related: z.array(slugSchema).default([]),
  /** Target complexities, quoted to the coach as the bar to meet. */
  targetComplexity: z.object({ time: z.string().min(1), space: z.string().min(1) }).optional(),
});

export const problemMetaSchema = z
  .discriminatedUnion('mode', [
    problemMetaBase.extend({
      mode: z.literal('function'),
      /** The method on `Solution` the harness calls. */
      entry: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'must be an identifier'),
      expect: expectModeSchema,
    }),
    problemMetaBase.extend({
      mode: z.literal('operations'),
      /** The class the harness constructs, then drives with `ops`. */
      entry: z.string().regex(/^[A-Z][a-zA-Z0-9_]*$/, 'must be a class name'),
      /**
       * Operations problems are judged on the sequence of return values; there
       * is no argument list left over to mutate.
       */
      expect: z.literal('return'),
    }),
  ])
  .check((ctx) => {
    const meta = ctx.value;
    if (tierForRating(meta.rating) !== meta.tier) {
      ctx.issues.push({
        code: 'custom',
        input: meta.rating,
        path: ['rating'],
        message: `rating ${meta.rating} is outside the ${meta.tier} band`,
      });
    }
    if (meta.related.includes(meta.slug)) {
      ctx.issues.push({
        code: 'custom',
        input: meta.related,
        path: ['related'],
        message: 'a problem cannot be related to itself',
      });
    }
  });

export type ProblemMeta = z.infer<typeof problemMetaSchema>;

// ---------------------------------------------------------------------------
// Custom checkers (ROADMAP D6)
// ---------------------------------------------------------------------------

/** What a problem's `checker.ts` receives for one test. */
export interface CheckerInput {
  /** The test as authored, so a checker can re-derive the answer from the input. */
  input: TestCase;
  expected: JsonValue | undefined;
  actual: JsonValue | undefined;
}

export type CheckerResult =
  | { pass: true; message?: string }
  /** The message is shown to the user, so say what was wrong, not just "incorrect". */
  | { pass: false; message: string };

/**
 * A problem's custom comparator. This is our TypeScript, loaded in-process by the
 * judge - never user code.
 */
export type CheckerFn = (args: CheckerInput) => CheckerResult | Promise<CheckerResult>;
