import { z } from 'zod';
import { languageSchema } from './language.js';
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
  attempts: z.int().min(0).default(0),
  solvedAt: z.iso.datetime().nullable().default(null),
  masteredAt: z.iso.datetime().nullable().default(null),
  lastAttemptedAt: z.iso.datetime().nullable().default(null),
});
export type ProblemProgress = z.infer<typeof problemProgressSchema>;

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
