import { describe, expect, it } from 'vitest';
import type { DashboardResponse, TopicSkill } from '@devpromax/shared';
import { coachBrief } from './coachBrief.js';
import { cumulative, ticksFor } from './SolvedChart.js';

/**
 * The two pure halves of the Progress dashboard (ROADMAP P9-6): the sentence
 * the coach's brief says, and the line the Solved chart draws.
 */

function dashboard(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  return {
    total: 10,
    byStatus: { not_started: 7, in_progress: 0, solved: 3, mastered: 0 },
    byTopic: [],
    byTier: [],
    streak: { current: 0, longest: 0, days: [] },
    solves: [],
    recent: [],
    skills: [],
    editorialsRevealed: 0,
    reviews: { due: [], upcoming: [] },
    driftedSolves: 0,
    generatedAt: '2026-09-23T12:00:00.000Z',
    ...overrides,
  };
}

function skill(topic: TopicSkill['topic'], average: number, samples = 2): TopicSkill {
  return { topic, samples, scores: {}, average };
}

describe('coachBrief', () => {
  it('names the strongest and the weakest topic from the coach marks', () => {
    const brief = coachBrief(
      dashboard({ skills: [skill('graph', 1.5), skill('arrays', 2.5), skill('hashmap', 3.8)] }),
    );
    expect(brief.headline).toBe('You are strongest in HashMap and weakest in Graph.');
    expect(brief.signals[0]).toBe('Weakest: Graph, 1.5 of 4 over 2 reviews.');
  });

  it('does not call one of two equal marks the stronger', () => {
    // The order between equal marks is the server's tie-break, not a finding (P4-17).
    const brief = coachBrief(dashboard({ skills: [skill('graph', 2.5), skill('heap', 2.5)] }));
    expect(brief.headline).toBe('My marks so far are level: Graph and Heap, all at 2.5 of 4.');
    expect(brief.signals.join(' ')).not.toMatch(/Strongest|Weakest/);
  });

  it('treats marks that print the same as the same', () => {
    const brief = coachBrief(
      dashboard({ skills: [skill('graph', 2.46), skill('heap', 2.54), skill('stack', 3.8)] }),
    );
    expect(brief.headline).toBe('You are strongest in Stack and weakest in Graph and Heap.');
    expect(brief.signals[0]).toBe('Weakest: Graph and Heap, 2.5 of 4.');
    expect(brief.signals[1]).toBe('Strongest: Stack, 3.8 of 4 over 2 reviews.');
  });

  it('counts a mastered problem as solved', () => {
    const brief = coachBrief(
      dashboard({ byStatus: { not_started: 9, in_progress: 0, solved: 0, mastered: 1 } }),
    );
    expect(brief.headline).not.toMatch(/^Nothing solved yet/);
  });

  it('says nothing is marked rather than inventing a judgement', () => {
    expect(coachBrief(dashboard()).headline).toMatch(/none of it reviewed yet/);
  });

  it('starts from the beginning when nothing is solved', () => {
    const brief = coachBrief(
      dashboard({ byStatus: { not_started: 10, in_progress: 0, solved: 0, mastered: 0 } }),
    );
    expect(brief.headline).toMatch(/^Nothing solved yet/);
  });
});

describe('cumulative', () => {
  const now = new Date('2026-09-23T12:00:00.000Z');

  it('starts the range at what was already solved before it', () => {
    const points = cumulative(
      [
        { day: '2026-09-22', count: 2 },
        { day: '2026-01-10', count: 5 },
      ],
      '1m',
      now,
    );
    expect(points).toHaveLength(30);
    expect(points[0]?.total).toBe(5);
    expect(points.at(-1)).toEqual({ day: '2026-09-23', total: 7 });
  });

  it('never dips: a quiet day is flat, not a fall', () => {
    const points = cumulative([{ day: '2026-09-20', count: 1 }], '1m', now);
    for (let i = 1; i < points.length; i++) {
      expect(points[i]?.total).toBeGreaterThanOrEqual(points[i - 1]?.total ?? 0);
    }
  });

  it('shows all of it back to the first solve', () => {
    const points = cumulative([{ day: '2026-03-01', count: 1 }], 'all', now);
    expect((points[0]?.day ?? '') <= '2026-03-01').toBe(true);
    expect(points.at(-1)?.total).toBe(1);
  });
});

describe('ticksFor', () => {
  it('never repeats a tick, however few solves there are', () => {
    // One solve used to give 0, 0.5, 1 - printed as 0, 1, 1, with duplicate keys (P4-17).
    for (let max = 0; max <= 40; max++) {
      const ticks = ticksFor(max);
      expect(new Set(ticks).size).toBe(ticks.length);
      expect(ticks.every(Number.isInteger)).toBe(true);
      expect(ticks.at(-1) ?? 0).toBeGreaterThanOrEqual(max);
    }
    expect(ticksFor(1)).toEqual([0, 1]);
    expect(ticksFor(2)).toEqual([0, 1, 2]);
  });
});
