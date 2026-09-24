import { describe, expect, it } from 'vitest';
import { calendarDaysAgo, localDay, relativeDay } from './relativeDay.js';

/**
 * Relative days (ROADMAP P4-17). Every date here is built from local parts, so
 * the file means the same thing in any time zone the tests run in.
 */

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

describe('relativeDay', () => {
  const now = new Date(2026, 8, 24, 0, 30);

  it('counts calendar days, not blocks of 24 hours', () => {
    // An hour ago, and yesterday: 23:30 on the 23rd.
    expect(relativeDay(at(23, 23, 30), now)).toBe('yesterday');
    // Twenty-five hours ago is two calendar days back.
    expect(relativeDay(at(22, 23, 30), now)).toBe('2 days ago');
    expect(relativeDay(at(24, 0, 5), now)).toBe('today');
  });

  it('calls yesterday morning yesterday, even less than 24 hours later', () => {
    const morning = new Date(2026, 8, 24, 8, 0);
    // Nine o'clock yesterday is 23 hours before eight today - "today" to a
    // 24-hour count, and plainly yesterday to anyone who slept in between.
    expect(relativeDay(at(23, 9), morning)).toBe('yesterday');
  });

  it('switches to the date after a week, with the year only when it differs', () => {
    expect(relativeDay(at(18, 12), now)).toBe('6 days ago');
    expect(relativeDay(at(17, 12), now)).toMatch(/17/);
    expect(relativeDay(at(17, 12), now)).not.toMatch(/2026/);
    expect(relativeDay(new Date(2025, 11, 30, 12).toISOString(), now)).toMatch(/2025/);
  });

  it('calls a timestamp from a clock that is ahead "today", not a negative day', () => {
    expect(relativeDay(at(25, 9), now)).toBe('today');
    expect(calendarDaysAgo(at(25, 9), now)).toBe(-1);
  });

  it('is not thrown by a clock change inside the span', () => {
    // Late October holds the end of summer time in much of the world; the
    // answer must be whole days whichever zone this runs in.
    const later = new Date(2026, 10, 2, 12);
    expect(calendarDaysAgo(new Date(2026, 9, 20, 12).toISOString(), later)).toBe(13);
  });
});

describe('localDay (P7-11)', () => {
  it("names this machine's date, not the UTC one", () => {
    // Built from local parts, so it is 23:30 on the 20th here whatever the zone:
    // in the Americas that is already the 21st in UTC.
    expect(localDay(new Date(2026, 8, 20, 23, 30))).toBe('2026-09-20');
    expect(localDay(new Date(2026, 0, 5, 0, 10))).toBe('2026-01-05');
  });
});
