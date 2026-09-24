/**
 * "Today", "yesterday", "3 days ago" (ROADMAP P4-17).
 *
 * Counted in calendar days on this machine's clock, not in blocks of 24 hours
 * since the event. The two disagree exactly where it shows: something done at
 * 23:30 was "today" at 00:30 by the 24-hour count, and something done at 09:00
 * yesterday was still "today" at 08:00 - while the user, who went to bed in
 * between, knows perfectly well which day it was.
 *
 * One helper for every screen that says how long ago. The list and Progress had
 * a formatter each, with different cut-offs and different words for the same
 * afternoon.
 */

/** Whole local calendar days from `iso` to `now`; 0 for the same day. */
export function calendarDaysAgo(iso: string, now: Date = new Date()): number {
  const then = new Date(iso);
  // Midnight-to-midnight in UTC terms, built from the *local* dates: a day with
  // a clock change in it is 23 or 25 hours long, and dividing real elapsed time
  // by 24 hours would round it the wrong way.
  const from = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  const to = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((to - from) / 86_400_000);
}

/**
 * The day something happened, as a person would say it: "today", "yesterday",
 * "N days ago" within the week, then the date - with the year only when it is
 * not this one. Anything dated after `now` (a clock that disagrees with the
 * server's) is "today" rather than a negative number of days.
 */
export function relativeDay(iso: string, now: Date = new Date()): string {
  const days = calendarDaysAgo(iso, now);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${String(days)} days ago`;

  const then = new Date(iso);
  return then.toLocaleDateString(
    undefined,
    then.getFullYear() === now.getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { month: 'short', year: 'numeric' },
  );
}

/**
 * Today's date on this machine, as the `YYYY-MM-DD` label the dashboard's days
 * use (P7-11).
 *
 * The server buckets activity into the viewer's own days when told the time
 * zone, so "today" on the calendar and the chart has to be the local date too -
 * `toISOString()` would name the UTC one, a day early all evening in the
 * Americas. The labels are only ever stepped through as UTC midnights, which is
 * calendar arithmetic and carries no zone of its own.
 */
export function localDay(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${String(now.getFullYear())}-${month}-${day}`;
}
