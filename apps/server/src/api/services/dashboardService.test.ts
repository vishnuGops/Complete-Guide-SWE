import { describe, expect, it } from 'vitest';
import { calendarDay, skillsFrom, solvesFrom, streakFrom } from './dashboardService.js';

/**
 * The two derivations the dashboard does that are not a count (ROADMAP P7-5).
 *
 * Both are pure functions taking what the database returned, which is the whole
 * reason they are exported: a streak that is wrong on the first of the month
 * should be findable without a database, a clock or a fixture directory.
 */

function days(...entries: string[]) {
  return entries.map((day) => ({ day, count: 1 }));
}

describe('streakFrom', () => {
  it('counts back from today', () => {
    const streak = streakFrom(days('2026-09-18', '2026-09-17', '2026-09-16'), '2026-09-18');
    expect(streak.current).toBe(3);
    expect(streak.longest).toBe(3);
  });

  it('does not break the streak just because today is still young', () => {
    // Nothing done yet this morning. The day is not over, so the run that ended
    // last night is still a run - anything else punishes someone for looking at
    // their dashboard before breakfast.
    const streak = streakFrom(days('2026-09-17', '2026-09-16'), '2026-09-18');
    expect(streak.current).toBe(2);
  });

  it('breaks once yesterday is quiet too', () => {
    expect(streakFrom(days('2026-09-16', '2026-09-15'), '2026-09-18').current).toBe(0);
  });

  it('is zero when nothing has ever happened', () => {
    expect(streakFrom([], '2026-09-18')).toEqual({ current: 0, longest: 0, days: [] });
  });

  it('crosses a month boundary', () => {
    const streak = streakFrom(days('2026-09-01', '2026-08-31', '2026-08-30'), '2026-09-01');
    expect(streak.current).toBe(3);
  });

  it('remembers the longest run even after it ends', () => {
    const streak = streakFrom(
      days('2026-09-18', '2026-09-10', '2026-09-09', '2026-09-08', '2026-09-07'),
      '2026-09-18',
    );
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(4);
  });
});

describe('skillsFrom', () => {
  const topics: Record<string, string> = { a: 'arrays', b: 'arrays', g: 'graph' };
  const topicOf = (slug: string) => topics[slug];

  function turn(slug: string, score: number) {
    return {
      slug,
      feedback: {
        scores: {
          correctness: score,
          timeComplexity: score,
          spaceComplexity: score,
          edgeCases: score,
          readability: score,
        },
      },
    };
  }

  it('averages every turn about a topic, not the last one per problem', () => {
    // Four goes at the same problem is what "this topic is hard for me" looks
    // like; keeping only the final score would erase exactly that.
    const skills = skillsFrom([turn('a', 1), turn('a', 3), turn('b', 2)], topicOf);

    expect(skills).toHaveLength(1);
    expect(skills[0]?.samples).toBe(3);
    expect(skills[0]?.average).toBeCloseTo(2);
  });

  it('puts the weakest topic first', () => {
    const skills = skillsFrom([turn('a', 4), turn('g', 1)], topicOf);
    expect(skills.map((skill) => skill.topic)).toEqual(['graph', 'arrays']);
  });

  it('breaks a tie on how much evidence there is', () => {
    const skills = skillsFrom([turn('a', 2), turn('a', 2), turn('g', 2)], topicOf);
    expect(skills.map((skill) => skill.topic)).toEqual(['arrays', 'graph']);
  });

  it('ignores a turn about a problem that is no longer in the catalogue', () => {
    // A deleted or renamed problem leaves its coach history behind; counting it
    // against a topic nobody can name is worse than not counting it.
    expect(skillsFrom([turn('gone', 0)], topicOf)).toEqual([]);
  });

  it('is empty before the coach has scored anything', () => {
    expect(skillsFrom([], topicOf)).toEqual([]);
  });
});

describe('solvesFrom (P9-6)', () => {
  const at = (slug: string, verdict: string, createdAt: string) => ({ slug, verdict, createdAt });

  it('counts each problem once, on the day it was first accepted', () => {
    const solves = solvesFrom([
      at('a', 'AC', '2026-09-20T10:00:00.000Z'),
      // A re-solve is a review, not a second solve.
      at('a', 'AC', '2026-09-21T10:00:00.000Z'),
      at('b', 'WA', '2026-09-19T09:00:00.000Z'),
      at('b', 'AC', '2026-09-21T11:00:00.000Z'),
      at('c', 'AC', '2026-09-21T23:59:59.000Z'),
    ]);
    expect(solves).toEqual([
      { day: '2026-09-21', count: 2 },
      { day: '2026-09-20', count: 1 },
    ]);
  });

  it('takes the earliest accept whatever order the archive arrives in', () => {
    // The archive is listed newest first; the first solve is the last row seen.
    expect(
      solvesFrom([
        at('a', 'AC', '2026-09-22T10:00:00.000Z'),
        at('a', 'AC', '2026-09-01T10:00:00.000Z'),
      ]),
    ).toEqual([{ day: '2026-09-01', count: 1 }]);
  });

  it('is empty before anything is accepted', () => {
    expect(solvesFrom([at('a', 'WA', '2026-09-22T10:00:00.000Z')])).toEqual([]);
  });

  it("puts a solve on the solver's own day (P7-11)", () => {
    // 01:30 UTC on the 21st is still the evening of the 20th in New York.
    const solves = solvesFrom(
      [at('a', 'AC', '2026-09-21T01:30:00.000Z')],
      calendarDay('America/New_York'),
    );
    expect(solves).toEqual([{ day: '2026-09-20', count: 1 }]);
  });
});

describe('calendarDay (P7-11)', () => {
  it('is the UTC date when no zone is given', () => {
    expect(calendarDay()('2026-09-21T23:30:00.000Z')).toBe('2026-09-21');
  });

  it('moves a timestamp to the local date on either side of UTC', () => {
    expect(calendarDay('America/Los_Angeles')('2026-09-21T03:00:00.000Z')).toBe('2026-09-20');
    expect(calendarDay('Asia/Kolkata')('2026-09-20T20:00:00.000Z')).toBe('2026-09-21');
  });

  it('keeps a late-night streak unbroken where UTC would split it', () => {
    // Two sessions in India: 23:00 on the 20th and 05:00 on the 21st, local
    // time - two days of practice. Both are the 20th in UTC, so counted in UTC
    // they were one active day and the streak read 1 on the 21st.
    const sessions = ['2026-09-20T17:30:00.000Z', '2026-09-20T23:30:00.000Z'];
    const toDays = (dayOf: (iso: string) => string) =>
      sessions.map(dayOf).map((day) => ({ day, count: 1 }));

    expect(streakFrom(toDays(calendarDay('Asia/Kolkata')), '2026-09-21').current).toBe(2);
    expect(new Set(toDays(calendarDay()).map((entry) => entry.day))).toEqual(
      new Set(['2026-09-20']),
    );
  });
});
