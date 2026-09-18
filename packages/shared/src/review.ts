import { z } from 'zod';
import { tierSchema, topicSchema } from './curriculum.js';
import { progressStatusSchema } from './progress.js';
import { slugSchema } from './problem.js';

/**
 * The spaced-repetition schedule (ROADMAP P7-8).
 *
 * Solving something once is not learning it. A problem comes back three days
 * later, then a week after that, then three weeks after that, and each time it
 * is re-solved the interval steps on; the fourth review and every one after it
 * stays at the longest step, because past a month the point is upkeep rather
 * than a ladder.
 *
 * Mastered problems come back on the same ladder at double the spacing. The
 * coach only sets Mastered when every rubric dimension is at the top (D13), so
 * the evidence that it stuck is stronger and the reminder can be rarer - but it
 * is not zero, because a solution you cannot reproduce in six weeks is not one
 * you know.
 */

/** Days after each successful pass. The last entry repeats forever. */
export const REVIEW_INTERVALS_DAYS = [3, 7, 21] as const;

/** Mastered stretches every interval by this much. */
export const MASTERED_INTERVAL_MULTIPLIER = 2;

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long until the next review, given how many passes there have been.
 *
 * `passes` counts every accepted submission for the problem: the first solve is
 * pass one, a re-solve is pass two. Zero and negative are treated as one, so a
 * caller that has not counted yet still gets the first interval rather than a
 * crash.
 */
export function reviewIntervalDays(passes: number, mastered: boolean): number {
  const step = Math.min(Math.max(passes, 1), REVIEW_INTERVALS_DAYS.length) - 1;
  const base = REVIEW_INTERVALS_DAYS[step] ?? REVIEW_INTERVALS_DAYS[0];
  return mastered ? base * MASTERED_INTERVAL_MULTIPLIER : base;
}

/** When a problem last passed at `lastPassedAt` is next due. */
export function reviewDueAt(lastPassedAt: string, passes: number, mastered: boolean): string {
  const due = new Date(lastPassedAt).getTime() + reviewIntervalDays(passes, mastered) * DAY_MS;
  return new Date(due).toISOString();
}

export const reviewItemSchema = z.object({
  slug: slugSchema,
  title: z.string(),
  topic: topicSchema,
  tier: tierSchema,
  status: progressStatusSchema,
  /** The most recent accepted submission. */
  lastPassedAt: z.iso.datetime(),
  /** How many accepted submissions there have been, first solve included. */
  passes: z.int().min(1),
  dueAt: z.iso.datetime(),
  /** Negative while it is still upcoming; whole days, rounded down. */
  overdueDays: z.int(),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const reviewQueueSchema = z.object({
  /** Due now or overdue, most overdue first. */
  due: z.array(reviewItemSchema),
  /** Not due yet, soonest first. The queue is also a calendar. */
  upcoming: z.array(reviewItemSchema),
});
export type ReviewQueue = z.infer<typeof reviewQueueSchema>;
