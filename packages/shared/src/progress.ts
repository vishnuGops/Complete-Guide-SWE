import { z } from 'zod';
import { languageSchema, type Language } from './language.js';
import { slugSchema } from './problem.js';
import { verdictSchema } from './judge.js';

/**
 * Four progress states (ROADMAP D11), ordered weakest to strongest. Tracked per
 * problem *and* language; the problem's headline status is the best of them.
 */
export const PROGRESS_STATUSES = ['not_started', 'in_progress', 'solved', 'mastered'] as const;
export const progressStatusSchema = z.enum(PROGRESS_STATUSES);
export type ProgressStatus = z.infer<typeof progressStatusSchema>;

export const PROGRESS_LABEL: Record<ProgressStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  solved: 'Solved',
  mastered: 'Mastered',
};

/** Rank of a status; status never moves backwards on its own (see P3-3). */
export function statusRank(status: ProgressStatus): number {
  return PROGRESS_STATUSES.indexOf(status);
}

export function bestStatus(statuses: readonly ProgressStatus[]): ProgressStatus {
  let best: ProgressStatus = 'not_started';
  for (const s of statuses) {
    if (statusRank(s) > statusRank(best)) best = s;
  }
  return best;
}

/**
 * Everything that can move a problem's status. Saving a draft is deliberately
 * absent: browsing and typing must not mark a problem In progress (D11).
 */
export const PROGRESS_EVENTS = [
  'run',
  'submit_accepted',
  'submit_rejected',
  'coach_mastered',
  'coach_not_mastered',
  'manual_override',
] as const;
export const progressEventSchema = z.enum(PROGRESS_EVENTS);
export type ProgressEvent = z.infer<typeof progressEventSchema>;

export const problemProgressSchema = z.object({
  slug: slugSchema,
  language: languageSchema,
  status: progressStatusSchema,
  /**
   * Submissions, not runs. Running is practice - a user who runs twenty times
   * and submits once has made one attempt, and a counter that says twenty would
   * make the list page read like a record of struggle rather than of work.
   */
  attempts: z.int().min(0).default(0),
  solvedAt: z.iso.datetime().nullable().default(null),
  masteredAt: z.iso.datetime().nullable().default(null),
  lastAttemptedAt: z.iso.datetime().nullable().default(null),
});
export type ProblemProgress = z.infer<typeof problemProgressSchema>;

// ---------------------------------------------------------------------------
// Status engine (ROADMAP P3-3)
// ---------------------------------------------------------------------------

/** The row a problem has before anything has happened to it. */
export function initialProgress(slug: string, language: Language): ProblemProgress {
  return {
    slug,
    language,
    status: 'not_started',
    attempts: 0,
    solvedAt: null,
    masteredAt: null,
    lastAttemptedAt: null,
  };
}

export interface ProgressTransition {
  event: ProgressEvent;
  /** Required for `manual_override`, ignored by every other event. */
  status?: ProgressStatus;
  /** When it happened; defaults to now. Passed explicitly by tests and backfills. */
  at?: string;
}

/** Promotes, never demotes. The one-way ratchet the whole engine is built on. */
function promote(current: ProgressStatus, to: ProgressStatus): ProgressStatus {
  return statusRank(to) > statusRank(current) ? to : current;
}

/**
 * The single place a problem's status is decided (D11).
 *
 * Pure: it takes the current row and one thing that happened, and returns the
 * next row. Nothing here reads a clock it was not given, touches a database, or
 * mutates its input - which is what lets the rules below be tested exhaustively
 * rather than sampled through the API.
 *
 * The rules, and why each is a rule:
 *
 * - **Only these events move status.** Saving a draft is not among them:
 *   browsing and typing must not mark a problem In progress.
 * - **Nothing demotes except a manual override.** A Wrong Answer after a solve
 *   is a person experimenting with a better approach, not a person un-solving
 *   the problem - and a progress display that can go backwards on its own is one
 *   users stop trusting.
 * - **`solvedAt` and `masteredAt` keep their first value.** They answer "when did
 *   you get this", which a later accepted submission does not change.
 * - **The coach cannot promote to Mastered on its own.** Mastery needs an
 *   accepted submission *and* a passing rubric (D11), so `coach_mastered`
 *   against anything below Solved is ignored: the rubric is a judgement about
 *   code that the judge has not agreed is correct yet.
 */
export function applyProgressEvent(
  current: ProblemProgress,
  transition: ProgressTransition,
): ProblemProgress {
  const at = transition.at ?? new Date().toISOString();
  const next: ProblemProgress = { ...current };

  switch (transition.event) {
    case 'run':
      next.status = promote(current.status, 'in_progress');
      next.lastAttemptedAt = at;
      break;

    case 'submit_rejected':
      next.status = promote(current.status, 'in_progress');
      next.attempts = current.attempts + 1;
      next.lastAttemptedAt = at;
      break;

    case 'submit_accepted':
      next.status = promote(current.status, 'solved');
      next.attempts = current.attempts + 1;
      next.lastAttemptedAt = at;
      next.solvedAt = current.solvedAt ?? at;
      break;

    case 'coach_mastered':
      if (statusRank(current.status) < statusRank('solved')) return { ...current };
      next.status = promote(current.status, 'mastered');
      next.masteredAt = current.masteredAt ?? at;
      break;

    case 'coach_not_mastered':
      // Deliberately nothing. A failed mastery check is the coach declining to
      // promote, not grounds to take away a status the user already earned, and
      // it is not an attempt either - no judge ran.
      return { ...current };

    case 'manual_override': {
      const target = transition.status;
      if (target === undefined) {
        throw new Error('manual_override requires the status to override to.');
      }
      // The only event allowed to move a status down: the user is the authority
      // on their own progress, including marking something they know they have
      // not really learned back to In progress.
      next.status = target;
      next.solvedAt = statusRank(target) >= statusRank('solved') ? (current.solvedAt ?? at) : null;
      next.masteredAt =
        statusRank(target) >= statusRank('mastered') ? (current.masteredAt ?? at) : null;
      break;
    }
  }

  return next;
}

/**
 * A problem's headline status: the best of its per-language rows (D11).
 *
 * Derived on read rather than stored, so it cannot drift from the rows it
 * summarises. A problem with no rows at all has not been started.
 */
export function problemStatus(rows: readonly ProblemProgress[]): ProgressStatus {
  return bestStatus(rows.map((row) => row.status));
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export const submissionSchema = z.object({
  id: z.uuid(),
  slug: slugSchema,
  language: languageSchema,
  /** Snapshot of the editor at submit time, so history can restore it. */
  code: z.string(),
  verdict: verdictSchema,
  passed: z.int().min(0),
  total: z.int().min(0),
  /** Slowest test in the run; the number shown next to the verdict. */
  timeMs: z.number().min(0),
  /** meta.version at submit time: a later test change must not silently rewrite history. */
  problemVersion: z.int().min(1),
  createdAt: z.iso.datetime(),
});
export type Submission = z.infer<typeof submissionSchema>;

/** A draft is autosaved editor content; it never affects status. */
export const draftSchema = z.object({
  slug: slugSchema,
  language: languageSchema,
  code: z.string(),
  updatedAt: z.iso.datetime(),
});
export type Draft = z.infer<typeof draftSchema>;
