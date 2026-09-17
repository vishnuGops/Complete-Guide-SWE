import { z } from 'zod';
import { ratingSchema, tierSchema, topicSchema } from './curriculum.js';
import { languageSchema } from './language.js';
import { MAX_CODE_BYTES } from './judge.js';
import {
  expectModeSchema,
  problemIdSchema,
  slugSchema,
  testCaseSchema,
  testModeSchema,
} from './problem.js';
import {
  draftSchema,
  problemProgressSchema,
  progressStatusSchema,
  submissionSchema,
  type ProgressStatus,
} from './progress.js';

/**
 * The HTTP contract (ROADMAP P3-1).
 *
 * Every request the server accepts and every response it sends is described
 * here, so the UI's types and the server's validation come from one file rather
 * than from two hopeful copies. The server parses requests with these schemas;
 * responses are typed from them and spot-checked in the API tests.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** One field-level complaint about a request, pointing at the offending path. */
export const apiIssueSchema = z.object({
  path: z.string().optional(),
  message: z.string(),
});
export type ApiIssue = z.infer<typeof apiIssueSchema>;

/**
 * The single error envelope. Every non-2xx response has this shape, including
 * the ones the hardening plugin sends before a route is ever reached.
 */
export const apiErrorSchema = z.object({
  /** Machine-readable tag, e.g. `NotFound`; the UI switches on this. */
  error: z.string(),
  /** One sentence fit to show a user. */
  message: z.string(),
  issues: z.array(apiIssueSchema).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

// ---------------------------------------------------------------------------
// Query parsing
// ---------------------------------------------------------------------------

/**
 * A repeatable query parameter.
 *
 * `?topic=arrays&topic=stack` and `?topic=arrays,stack` mean the same thing: the
 * first is what a URLSearchParams round-trip produces, the second is what people
 * type by hand, and rejecting either would be a trap rather than a contract.
 */
function multi<T extends z.ZodType>(item: T) {
  return z.preprocess((raw) => {
    if (raw === undefined || raw === null || raw === '') return [];
    const parts = (Array.isArray(raw) ? raw : [raw]).flatMap((value) =>
      typeof value === 'string' ? value.split(',') : [value],
    );
    return parts
      .map((value) => (typeof value === 'string' ? value.trim() : value))
      .filter((value) => value !== '');
  }, z.array(item));
}

// ---------------------------------------------------------------------------
// GET /api/problems
// ---------------------------------------------------------------------------

/**
 * `default` is rating ascending, then curriculum order (topic position, then the
 * problem's `order`) - the learning path. Every other key falls back to it for
 * ties, so the list is never in an arbitrary order.
 */
export const PROBLEM_SORT_KEYS = [
  'default',
  'title',
  'topic',
  'tier',
  'rating',
  'status',
  'lastAttempted',
] as const;
export const problemSortSchema = z.enum(PROBLEM_SORT_KEYS);
export type ProblemSort = z.infer<typeof problemSortSchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export const problemListQuerySchema = z.object({
  topic: multi(topicSchema),
  tier: multi(tierSchema),
  status: multi(progressStatusSchema),
  /** Substring match over title and patterns, case-insensitive. */
  q: z.string().trim().max(120).optional(),
  /**
   * Narrows progress to one language: a problem's status becomes its status in
   * that language, so `?status=solved&language=python` reads as "solved in
   * Python" rather than "solved in either language".
   */
  language: languageSchema.optional(),
  sort: problemSortSchema.default('default'),
  dir: sortDirectionSchema.default('asc'),
});
export type ProblemListQuery = z.infer<typeof problemListQuerySchema>;

/** A row in the problem list. Deliberately small: no statement, no code. */
export const problemSummarySchema = z.object({
  id: problemIdSchema,
  slug: slugSchema,
  title: z.string(),
  topic: topicSchema,
  tier: tierSchema,
  rating: ratingSchema,
  order: z.int().min(0),
  patterns: z.array(z.string()),
  mode: testModeSchema,
  /** Best status across languages, or the filtered language's status. */
  status: progressStatusSchema,
  /** Per-language status, so the list can show which language it was solved in. */
  statusByLanguage: z.partialRecord(languageSchema, progressStatusSchema),
  attempts: z.int().min(0),
  lastAttemptedAt: z.iso.datetime().nullable(),
  solvedAt: z.iso.datetime().nullable(),
});
export type ProblemSummary = z.infer<typeof problemSummarySchema>;

export const topicCountSchema = z.object({
  topic: topicSchema,
  total: z.int().min(0),
  solved: z.int().min(0),
  mastered: z.int().min(0),
  inProgress: z.int().min(0),
});
export type TopicCount = z.infer<typeof topicCountSchema>;

export const tierCountSchema = z.object({
  tier: tierSchema,
  total: z.int().min(0),
  solved: z.int().min(0),
  mastered: z.int().min(0),
  inProgress: z.int().min(0),
});
export type TierCount = z.infer<typeof tierCountSchema>;

export const statusCountsSchema = z.object({
  not_started: z.int().min(0),
  in_progress: z.int().min(0),
  solved: z.int().min(0),
  mastered: z.int().min(0),
});
export type StatusCounts = z.infer<typeof statusCountsSchema>;

export const problemListResponseSchema = z.object({
  items: z.array(problemSummarySchema),
  /** How many rows matched the filters. */
  matched: z.int().min(0),
  /**
   * Counts over the whole catalogue, never over the filtered rows: "Solved 42 /
   * 200" and the per-topic counts beside the filters must not move when the user
   * filters, or they stop meaning anything.
   */
  total: z.int().min(0),
  byStatus: statusCountsSchema,
  byTopic: z.array(topicCountSchema),
});
export type ProblemListResponse = z.infer<typeof problemListResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/problems/:slug
// ---------------------------------------------------------------------------

export const relatedProblemSchema = z.object({
  slug: slugSchema,
  title: z.string(),
  tier: tierSchema,
  rating: ratingSchema,
});
export type RelatedProblem = z.infer<typeof relatedProblemSchema>;

export const problemDetailSchema = z.object({
  summary: problemSummarySchema,
  /** Raw markdown; the client renders and sanitises it (P4-3). */
  statement: z.string(),
  entry: z.string(),
  expect: expectModeSchema,
  comparator: z.string(),
  targetComplexity: z.object({ time: z.string(), space: z.string() }).optional(),
  version: z.int().min(1),
  /** Per-test time budget actually applied, after the settings multiplier. */
  timeoutMs: z.partialRecord(languageSchema, z.int()),
  /** The tests shown in the statement. Hidden tests are never sent. */
  samples: z.array(testCaseSchema),
  hiddenCount: z.int().min(0),
  /** The static ladder; the UI reveals one rung at a time (P7-1). */
  hints: z.array(z.string()),
  /**
   * Withheld until the problem is solved (P7-2 adds the explicit reveal). The
   * gate lives here rather than in the UI, because a locked editorial that was
   * already in the payload is not locked.
   */
  editorial: z.string().nullable(),
  editorialUnlocked: z.boolean(),
  starters: z.record(languageSchema, z.string()),
  drafts: z.partialRecord(languageSchema, draftSchema),
  progress: z.array(problemProgressSchema),
  submissionCount: z.int().min(0),
  /** File names under the problem's `assets/`, served by the assets route. */
  assets: z.array(z.string()),
  note: z.string().nullable(),
  related: z.array(relatedProblemSchema),
});
export type ProblemDetail = z.infer<typeof problemDetailSchema>;

// ---------------------------------------------------------------------------
// GET /api/problems/:slug/submissions
// ---------------------------------------------------------------------------

export const submissionListQuerySchema = z.object({
  language: languageSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type SubmissionListQuery = z.infer<typeof submissionListQuerySchema>;

export const submissionListResponseSchema = z.object({
  items: z.array(submissionSchema),
});
export type SubmissionListResponse = z.infer<typeof submissionListResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/progress
// ---------------------------------------------------------------------------

export const progressResponseSchema = z.object({
  rows: z.array(problemProgressSchema),
  total: z.int().min(0),
  byStatus: statusCountsSchema,
  byTopic: z.array(topicCountSchema),
  byTier: z.array(tierCountSchema),
});
export type ProgressResponse = z.infer<typeof progressResponseSchema>;

// ---------------------------------------------------------------------------
// PUT /api/drafts/:slug/:language
// ---------------------------------------------------------------------------

export const draftUpdateSchema = z.object({
  code: z.string().max(MAX_CODE_BYTES),
});
export type DraftUpdate = z.infer<typeof draftUpdateSchema>;

/** `draft` is null after a reset-to-starter, which deletes the row. */
export const draftResponseSchema = z.object({
  draft: draftSchema.nullable(),
});
export type DraftResponse = z.infer<typeof draftResponseSchema>;

// ---------------------------------------------------------------------------
// Run and Submit
// ---------------------------------------------------------------------------

/**
 * `POST /api/run` and `POST /api/submit` take the run request without its
 * `kind`: the route the client posted to is what decides that, so a body
 * claiming otherwise cannot turn a Run into a recorded Submit.
 */
export const runBodySchema = z.object({
  slug: slugSchema,
  language: languageSchema,
  code: z.string().max(MAX_CODE_BYTES),
  /** Ignored by `/api/submit`, which runs the problem's own tests only. */
  customTests: z.array(testCaseSchema).max(20).optional(),
});
export type RunBody = z.infer<typeof runBodySchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** What `POST /api/settings/test-connection` reports back. */
export const connectionTestResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.enum(['anthropic', 'gemini']),
  /** The model that was checked, when one is configured. */
  model: z.string().nullable(),
  message: z.string(),
});
export type ConnectionTestResponse = z.infer<typeof connectionTestResponseSchema>;

/** What `POST /api/settings/reset-progress` deleted, so the UI can say so. */
export const resetProgressResponseSchema = z.object({
  cleared: z.object({
    submissions: z.int().min(0),
    progress: z.int().min(0),
    drafts: z.int().min(0),
    events: z.int().min(0),
    coachSessions: z.int().min(0),
  }),
});
export type ResetProgressResponse = z.infer<typeof resetProgressResponseSchema>;

// ---------------------------------------------------------------------------
// Aggregation helpers, shared by the list, the dashboard and their tests
// ---------------------------------------------------------------------------

export function emptyStatusCounts(): StatusCounts {
  return { not_started: 0, in_progress: 0, solved: 0, mastered: 0 };
}

/** Tallies statuses into the shape the list header and the dashboard both use. */
export function countByStatus(statuses: readonly ProgressStatus[]): StatusCounts {
  const counts = emptyStatusCounts();
  for (const status of statuses) counts[status] += 1;
  return counts;
}

/** Solved *or better*: a mastered problem is a solved one, and reads wrong otherwise. */
export function solvedCount(counts: StatusCounts): number {
  return counts.solved + counts.mastered;
}

export interface GroupedCount {
  total: number;
  solved: number;
  mastered: number;
  inProgress: number;
}

/** The per-topic and per-tier tally used by the filters sidebar and the dashboard. */
export function groupCounts(statuses: readonly ProgressStatus[]): GroupedCount {
  const counts = countByStatus(statuses);
  return {
    total: statuses.length,
    solved: solvedCount(counts),
    mastered: counts.mastered,
    inProgress: counts.in_progress,
  };
}
