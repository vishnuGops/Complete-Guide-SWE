import { z } from 'zod';
import { ratingSchema, tierSchema, topicSchema } from './curriculum.js';
import { coachProviderSchema } from './coach.js';
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
  MAX_NOTE_BYTES,
  draftSchema,
  noteSchema,
  problemProgressSchema,
  progressStatusSchema,
  submissionSchema,
  type ProgressStatus,
} from './progress.js';
import { reviewQueueSchema } from './review.js';

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
  /** Substring match over title, patterns and notes, case-insensitive. */
  q: z.string().trim().max(120).optional(),
  /** Only starred problems (P7-7). Absent means "all of them", not "unstarred". */
  bookmarked: z.stringbool().optional(),
  /**
   * Only what the review queue says is due now (P9-6). Absent means "all of
   * them"; like `bookmarked`, there is no "not due".
   */
  due: z.stringbool().optional(),
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
  /**
   * Whether this problem has a note (P7-4). The body is not sent with a list
   * row - that would be the whole point of the summary being small - but
   * without this a search that matched a note shows a row with nothing on it
   * saying why.
   */
  hasNote: z.boolean(),
  /** Starred by the user (P7-7). Its own thing, not a status: D11's ratchet is about work done. */
  bookmarked: z.boolean(),
  /** `meta.version` as it stands now. */
  version: z.int().min(1),
  /**
   * The newest version this problem has been accepted against, or null if it
   * never has been (P7-9).
   *
   * Below `version` means the tests have changed since it was solved. The
   * status does not move for that - D11's ratchet stands and the user decides -
   * but the row says so, because a Solved earned against tests that no longer
   * exist is worth knowing about.
   */
  solvedVersion: z.int().min(1).nullable(),
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
  /**
   * How many solved problems are due for review now (P9-6), catalogue-wide like
   * the counts above. The list's header says it, and the Due view filters to it.
   */
  due: z.int().min(0),
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
   * How many rungs this user has already read (P7-1).
   *
   * Sent with the problem rather than fetched separately, because the workspace
   * needs it before the first paint: a hint the user unlocked yesterday that
   * re-hides itself on reload is a hint they have to spend again.
   */
  revealedHints: z.int().min(0),
  /**
   * Withheld until the problem is solved (P7-2 adds the explicit reveal). The
   * gate lives here rather than in the UI, because a locked editorial that was
   * already in the payload is not locked.
   */
  editorial: z.string().nullable(),
  editorialUnlocked: z.boolean(),
  /**
   * The reference solutions, sent only once the editorial is unlocked (P7-2).
   *
   * Null while it is locked, and absent from the payload entirely rather than
   * sent-and-hidden: a solution the client already holds is not withheld, it is
   * one View Source away.
   */
  references: z.record(languageSchema, z.string()).nullable(),
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
// POST /api/problems/:slug/hints
// ---------------------------------------------------------------------------

/**
 * Unlocking a rung of the hint ladder (ROADMAP P7-1).
 *
 * The body says which rung is now visible, not "one more": two clicks that race
 * each other would otherwise increment twice for one hint. The server keeps the
 * highest it has been told, so the same request sent twice is the same state.
 */
export const hintRevealSchema = z.object({
  revealed: z.int().min(1),
});
export type HintReveal = z.infer<typeof hintRevealSchema>;

export const hintRevealResponseSchema = z.object({
  /** The count after the write, which is the highest ever reached. */
  revealed: z.int().min(0),
});
export type HintRevealResponse = z.infer<typeof hintRevealResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/problems/:slug/submissions
// ---------------------------------------------------------------------------

/**
 * Where a page of submission history ends: the last row's `createdAt` and `id`,
 * as `<createdAt>|<id>` (ROADMAP P3-10).
 *
 * The timestamp alone skipped rows. Two submissions can share a millisecond,
 * and "strictly older than the last row" then drops the other one at the
 * page boundary. The id says which of the tied rows the page ended on. A bare
 * timestamp is still accepted and means what it used to.
 */
export interface SubmissionCursor {
  createdAt: string;
  id?: string;
}

const isoDateTime = z.iso.datetime();
const cursorId = z.uuid();

export function parseSubmissionCursor(cursor: string): SubmissionCursor | null {
  const [createdAt = '', id, ...rest] = cursor.split('|');
  if (rest.length > 0 || !isoDateTime.safeParse(createdAt).success) return null;
  if (id === undefined) return { createdAt };
  return cursorId.safeParse(id).success ? { createdAt, id } : null;
}

export function submissionCursor(row: { createdAt: string; id: string }): string {
  return `${row.createdAt}|${row.id}`;
}

export const submissionListQuerySchema = z.object({
  language: languageSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /**
   * Cursor: only submissions after this one in newest-first order (P7-9).
   *
   * The previous page's `nextCursor`. A cursor rather than an offset, because
   * the list is newest-first and a submit made while someone is reading page
   * two would shift every offset by one and show them a row they had already
   * seen.
   */
  before: z
    .string()
    .refine((value) => parseSubmissionCursor(value) !== null, 'Not a submission cursor.')
    .optional(),
});
export type SubmissionListQuery = z.infer<typeof submissionListQuerySchema>;

export const submissionListResponseSchema = z.object({
  items: z.array(submissionSchema),
  /** Pass back as `before` for the next page. Null when this is the last one. */
  nextCursor: z.string().nullable(),
});
export type SubmissionListResponse = z.infer<typeof submissionListResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/problems/:slug/re-verify
// ---------------------------------------------------------------------------

/**
 * Re-running the last accepted code against the tests as they stand (P7-9).
 *
 * The body names a language because a problem can be solved in both, and each
 * has its own last accepted answer. The result is an ordinary `RunResult` from
 * an ordinary submit: it is recorded, it can fail, and a failure does not
 * demote anything - D11's ratchet stands and the user decides what to do.
 */
export const reVerifySchema = z.object({
  language: languageSchema,
});
export type ReVerify = z.infer<typeof reVerifySchema>;

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
// PUT / DELETE /api/bookmarks/:slug
// ---------------------------------------------------------------------------

/** `bookmarked` is the state afterwards, so the caller does not have to infer it. */
export const bookmarkResponseSchema = z.object({
  slug: slugSchema,
  bookmarked: z.boolean(),
});
export type BookmarkResponse = z.infer<typeof bookmarkResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/next
// ---------------------------------------------------------------------------

export const NEXT_MODES = ['recommended', 'random', 'review'] as const;
export const nextModeSchema = z.enum(NEXT_MODES);
export type NextMode = z.infer<typeof nextModeSchema>;

export const nextQuerySchema = z.object({
  mode: nextModeSchema.default('recommended'),
});
export type NextQuery = z.infer<typeof nextQuerySchema>;

/**
 * What to do next (ROADMAP P7-7).
 *
 * `reason` is shown beside the suggestion, because a recommendation with no
 * stated reason is indistinguishable from a random pick - and one of the two
 * modes here *is* a random pick.
 */
export const nextProblemResponseSchema = z.object({
  problem: problemSummarySchema.nullable(),
  reason: z.string(),
});
export type NextProblemResponse = z.infer<typeof nextProblemResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/doctor
// ---------------------------------------------------------------------------

/** `docker` is the daemon, checked only when the judge runs in containers (P9-2). */
export const RUNTIME_NAMES = ['python', 'java', 'javac', 'docker'] as const;
export const runtimeNameSchema = z.enum(RUNTIME_NAMES);
export type RuntimeName = z.infer<typeof runtimeNameSchema>;

/**
 * One runtime the judge shells out to (ROADMAP P8-3).
 *
 * `problem` and `guidance` are a pair: what is wrong, and the one sentence that
 * fixes it. A check that says "python: not found" and stops has told the user
 * something they already suspected.
 */
export const runtimeCheckSchema = z.object({
  name: runtimeNameSchema,
  /**
   * What was actually run, including a `DEVPROMAX_*` override if one is set -
   * or, for a runtime inside a Docker image, the image.
   */
  command: z.string(),
  ok: z.boolean(),
  /** As the runtime reported it - "3.14", "21" - or null when it did not answer. */
  version: z.string().nullable(),
  problem: z.string().nullable(),
  guidance: z.string().nullable(),
});
export type RuntimeCheck = z.infer<typeof runtimeCheckSchema>;

/** Where the judge runs code (ROADMAP P9-2), set by `DEVPROMAX_EXECUTOR`. */
export const EXECUTOR_KINDS = ['local', 'docker'] as const;
export const executorKindSchema = z.enum(EXECUTOR_KINDS);
export type ExecutorKind = z.infer<typeof executorKindSchema>;

export const runtimeReportSchema = z.object({
  /** Which set of checks this is: the runtimes here, or Docker and its images. */
  executor: executorKindSchema,
  checks: z.array(runtimeCheckSchema),
  ok: z.boolean(),
  checkedAt: z.iso.datetime(),
});
export type RuntimeReport = z.infer<typeof runtimeReportSchema>;

// ---------------------------------------------------------------------------
// GET /api/dashboard
// ---------------------------------------------------------------------------

/** Whether this runtime knows `name` as an IANA time zone ("Asia/Kolkata"). */
export function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/**
 * The viewer's time zone, which is what a "day" on the dashboard means (P7-11).
 *
 * Timestamps are stored in UTC and stay that way; only the bucketing into days
 * moves. A streak is a promise about the practiser's own days, and a UTC day
 * splits an evening in the Americas or a late night in India across two of
 * them. Optional, so a client that sends none gets the UTC days it always did.
 */
export const timeZoneSchema = z.string().min(1).max(64).refine(isTimeZone, {
  message: 'not a time zone this machine knows',
});

export const dashboardQuerySchema = z.object({
  tz: timeZoneSchema.optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/** One day of the streak calendar. */
export const activeDaySchema = z.object({
  /**
   * `YYYY-MM-DD` in the time zone the request named (P7-11), or in UTC when it
   * named none.
   */
  day: z.string(),
  count: z.int().min(0),
});
export type ActiveDay = z.infer<typeof activeDaySchema>;

export const streakSchema = z.object({
  /**
   * Days up to and including today. Today not being active yet does not break
   * the streak - it is not over until the day is - so a run that ends yesterday
   * still counts while today is young.
   */
  current: z.int().min(0),
  longest: z.int().min(0),
  /** Active days only, newest first. A year of mostly-zeroes is not worth sending. */
  days: z.array(activeDaySchema),
});
export type Streak = z.infer<typeof streakSchema>;

export const activityKindSchema = z.enum([
  'run',
  'submit',
  'coach_feedback',
  'hint_revealed',
  'editorial_revealed',
  'status_override',
]);
export type ActivityKind = z.infer<typeof activityKindSchema>;

export const recentActivitySchema = z.object({
  kind: activityKindSchema,
  slug: slugSchema.nullable(),
  /** The problem's title, resolved here so the client does not need the catalogue. */
  title: z.string().nullable(),
  language: languageSchema.nullable(),
  /** The verdict, for a `submit`; null for everything else. */
  verdict: z.string().nullable(),
  at: z.iso.datetime(),
});
export type RecentActivity = z.infer<typeof recentActivitySchema>;

/**
 * How one topic scores, averaged over every coach turn about it (P7-5).
 *
 * `samples` is how many turns went into it, and the UI has to show it: an
 * average of one turn is an anecdote, and "your weakest topic" chosen from
 * anecdotes would send people to practise the wrong thing.
 */
export const topicSkillSchema = z.object({
  topic: topicSchema,
  samples: z.int().min(0),
  scores: z.record(z.string(), z.number()),
  /** Mean across the five dimensions, 0-4. What the list is sorted by. */
  average: z.number(),
});
export type TopicSkill = z.infer<typeof topicSkillSchema>;

export const dashboardResponseSchema = z.object({
  total: z.int().min(0),
  byStatus: statusCountsSchema,
  byTopic: z.array(topicCountSchema),
  byTier: z.array(tierCountSchema),
  streak: streakSchema,
  /**
   * First solves per day, newest first (P9-6): the day each problem was
   * first accepted, in any language. What the Solved chart draws, cumulatively.
   * Every day with a first solve, not a window: the catalogue is a few hundred
   * problems, so this is at most a few hundred rows.
   */
  solves: z.array(activeDaySchema),
  recent: z.array(recentActivitySchema),
  /** Weakest first. Empty until the coach has scored something. */
  skills: z.array(topicSkillSchema),
  /** Problems whose editorial was opened rather than earned (P7-2). */
  editorialsRevealed: z.int().min(0),
  /** What is due for a re-solve, and what is coming (P7-8). */
  reviews: reviewQueueSchema,
  /** Solved against tests that have since changed (P7-9), counted apart from the rest. */
  driftedSolves: z.int().min(0),
  /** When this was produced, which the exported report is dated by. */
  generatedAt: z.iso.datetime(),
});
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const REPORT_FORMATS = ['json', 'markdown', 'html'] as const;
export const reportFormatSchema = z.enum(REPORT_FORMATS);
export type ReportFormat = z.infer<typeof reportFormatSchema>;

export const reportQuerySchema = z.object({
  format: reportFormatSchema.default('markdown'),
  /** The same days the screen showed, so the file agrees with it (P7-11). */
  tz: timeZoneSchema.optional(),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

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
// PUT /api/notes/:slug
// ---------------------------------------------------------------------------

export const noteUpdateSchema = z.object({
  body: z.string().max(MAX_NOTE_BYTES),
});
export type NoteUpdate = z.infer<typeof noteUpdateSchema>;

/** `note` is null once the body is blank: an empty note is no note (P7-4). */
export const noteResponseSchema = z.object({
  note: noteSchema.nullable(),
});
export type NoteResponse = z.infer<typeof noteResponseSchema>;

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
  /**
   * Elapsed interview-mode timer, in milliseconds (P7-6). Recorded on the
   * submission; ignored by `/api/run`, which is not an attempt at anything.
   * Capped at a day, because a timer left running overnight is not a solve time.
   */
  solveMs: z.number().min(0).max(86_400_000).optional(),
});
export type RunBody = z.infer<typeof runBodySchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** What `POST /api/settings/test-connection` reports back. */
export const connectionTestResponseSchema = z.object({
  ok: z.boolean(),
  // The enum, not a copy of it: a third provider (P9-4) must not need an edit here.
  provider: coachProviderSchema,
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
    interviews: z.int().min(0),
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
