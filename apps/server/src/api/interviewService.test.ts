import { describe, expect, it } from 'vitest';
import type { ProblemSummary } from '@devpromax/shared';
import { chooseProblems } from './interviewService.js';

/**
 * Which two problems an interview asks (ROADMAP P9-1).
 *
 * The one judgement in the feature that is not a state transition, and the one
 * worth pinning: a sitting that opens with the hardest thing in the catalogue,
 * or that asks something the candidate solved last week, measures nothing.
 */

function problem(overrides: Partial<ProblemSummary>): ProblemSummary {
  return {
    id: 'x',
    slug: 'x',
    title: 'X',
    topic: 'arrays',
    tier: 'Easy',
    rating: 2,
    order: 0,
    patterns: [],
    mode: 'function',
    status: 'not_started',
    statusByLanguage: {},
    attempts: 0,
    lastAttemptedAt: null,
    solvedAt: null,
    hasNote: false,
    bookmarked: false,
    version: 1,
    solvedVersion: null,
    ...overrides,
  };
}

const CATALOGUE = [
  problem({ slug: 'easy-1', tier: 'Easy', rating: 2 }),
  problem({ slug: 'easy-2', tier: 'Easy', rating: 3 }),
  problem({ slug: 'medium-1', tier: 'Medium', rating: 5, topic: 'graph' }),
  problem({ slug: 'medium-2', tier: 'Medium', rating: 6, topic: 'heap' }),
  problem({ slug: 'hard-1', tier: 'Hard', rating: 9, topic: 'graph' }),
];

describe('chooseProblems', () => {
  it('opens on something easy and follows it with something harder', () => {
    const [first, second] = chooseProblems(CATALOGUE, null);

    // A screen that opens with the hardest thing in it measures nerve.
    expect(first?.tier).toBe('Easy');
    expect(second?.tier).not.toBe('Easy');
    expect(second?.rating).toBeGreaterThan(first?.rating ?? 0);
  });

  it('asks the weakest topic for the harder one', () => {
    const [, second] = chooseProblems(CATALOGUE, 'heap');
    expect(second?.topic).toBe('heap');
  });

  it('never asks something already solved', () => {
    // Being asked what you did last week is not an interview.
    const solved = CATALOGUE.map((entry) =>
      entry.slug === 'easy-1' ? { ...entry, status: 'solved' as const } : entry,
    );
    const chosen = chooseProblems(solved, null);
    expect(chosen.map((entry) => entry.slug)).not.toContain('easy-1');
  });

  it('does not reach for the hardest problem in the catalogue', () => {
    // An interview nobody can finish measures nothing either.
    const [, second] = chooseProblems(CATALOGUE, null);
    expect(second?.slug).not.toBe('hard-1');
  });

  it('falls back when there is nothing easy left', () => {
    const noneEasy = CATALOGUE.filter((entry) => entry.tier !== 'Easy');
    const chosen = chooseProblems(noneEasy, null);

    expect(chosen).toHaveLength(2);
    // Still the easier one first, whatever "easier" means in what is left.
    expect(chosen[0]?.rating).toBeLessThanOrEqual(chosen[1]?.rating ?? 0);
  });

  it('gives back what it can when there is not enough', () => {
    // The caller turns a short list into a message; this does not invent a
    // second problem by repeating the first.
    expect(chooseProblems([CATALOGUE[0]!], null)).toHaveLength(1);
    expect(chooseProblems([], null)).toEqual([]);
    expect(
      chooseProblems(
        CATALOGUE.map((entry) => ({ ...entry, status: 'solved' as const })),
        null,
      ),
    ).toEqual([]);
  });

  it('never asks the same problem twice', () => {
    const chosen = chooseProblems(CATALOGUE, 'arrays');
    expect(new Set(chosen.map((entry) => entry.slug)).size).toBe(chosen.length);
  });
});
