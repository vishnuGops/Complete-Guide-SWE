import { describe, expect, it } from 'vitest';
import {
  MASTERED_INTERVAL_MULTIPLIER,
  REVIEW_INTERVALS_DAYS,
  reviewDueAt,
  reviewIntervalDays,
} from './review.js';

/**
 * The spaced-repetition schedule (ROADMAP P7-8).
 *
 * Pure arithmetic, and worth pinning: the whole queue is this function plus a
 * count of accepted submissions, so an off-by-one here is a problem that either
 * never comes back or comes back every day.
 */

describe('reviewIntervalDays', () => {
  it('walks the ladder one step per pass', () => {
    expect(reviewIntervalDays(1, false)).toBe(REVIEW_INTERVALS_DAYS[0]);
    expect(reviewIntervalDays(2, false)).toBe(REVIEW_INTERVALS_DAYS[1]);
    expect(reviewIntervalDays(3, false)).toBe(REVIEW_INTERVALS_DAYS[2]);
  });

  it('stays at the longest step rather than growing forever', () => {
    // Past a month the point is upkeep, not a ladder, and an interval that
    // doubled every time would eventually mean never.
    const longest = REVIEW_INTERVALS_DAYS[REVIEW_INTERVALS_DAYS.length - 1];
    expect(reviewIntervalDays(4, false)).toBe(longest);
    expect(reviewIntervalDays(40, false)).toBe(longest);
  });

  it('treats a missing or nonsense count as the first pass', () => {
    // A caller that has not counted yet should get the first interval, not a
    // negative date.
    expect(reviewIntervalDays(0, false)).toBe(REVIEW_INTERVALS_DAYS[0]);
    expect(reviewIntervalDays(-3, false)).toBe(REVIEW_INTERVALS_DAYS[0]);
  });

  it('stretches every step for a mastered problem, without skipping any', () => {
    for (const [index, days] of REVIEW_INTERVALS_DAYS.entries()) {
      expect(reviewIntervalDays(index + 1, true)).toBe(days * MASTERED_INTERVAL_MULTIPLIER);
    }
    // Rarer, but never zero: a solution you cannot reproduce in six weeks is
    // not one you know.
    expect(reviewIntervalDays(99, true)).toBeGreaterThan(0);
  });
});

describe('reviewDueAt', () => {
  it('adds the interval to when it last passed', () => {
    expect(reviewDueAt('2026-09-18T09:00:00.000Z', 1, false)).toBe('2026-09-21T09:00:00.000Z');
    expect(reviewDueAt('2026-09-18T09:00:00.000Z', 2, false)).toBe('2026-09-25T09:00:00.000Z');
  });

  it('crosses a month boundary', () => {
    expect(reviewDueAt('2026-09-28T09:00:00.000Z', 1, false)).toBe('2026-10-01T09:00:00.000Z');
  });

  it('keeps the time of day, so a review does not drift earlier each round', () => {
    // Three passes on a mastered problem is 21 days doubled: forty-two days on
    // from the eighteenth of September, at the same time of day.
    expect(reviewDueAt('2026-09-18T23:30:00.000Z', 3, true)).toBe('2026-10-30T23:30:00.000Z');
  });
});
