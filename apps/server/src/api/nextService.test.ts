import { describe, expect, it } from 'vitest';
import type { ProblemSummary, TopicSkill } from '@devpromax/shared';
import { weakestTopic } from './nextService.js';

/**
 * Which topic to send someone to (ROADMAP P7-7).
 *
 * Exported and tested on its own because it is the one judgement in the
 * recommendation: everything around it is a sort the list already does.
 */

function problem(overrides: Partial<ProblemSummary>): ProblemSummary {
  return {
    id: 'x',
    slug: 'x',
    title: 'X',
    topic: 'arrays',
    tier: 'Easy',
    rating: 1,
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

function skill(topic: TopicSkill['topic'], average: number, samples = 2): TopicSkill {
  return { topic, samples, scores: {}, average };
}

describe('weakestTopic', () => {
  it('prefers what the coach scored lowest', () => {
    const chosen = weakestTopic(
      [skill('graph', 1.5), skill('arrays', 3.5)],
      [problem({ slug: 'g', topic: 'graph' }), problem({ slug: 'a', topic: 'arrays' })],
    );

    expect(chosen?.topic).toBe('graph');
    expect(chosen?.reason).toContain('lowest-scoring');
    // The number is in the reason, because "graph is your weakest" with nothing
    // behind it is not a reason, it is an assertion.
    expect(chosen?.reason).toContain('1.5');
  });

  it('skips a scored topic with nothing left to do in it', () => {
    // Being bad at a topic you have finished is not something to act on today.
    const chosen = weakestTopic(
      [skill('graph', 1.0), skill('arrays', 3.0)],
      [
        problem({ slug: 'g', topic: 'graph', status: 'solved' }),
        problem({ slug: 'a', topic: 'arrays' }),
      ],
    );

    expect(chosen?.topic).toBe('arrays');
  });

  it('falls back to the least-finished topic before the coach has scored anything', () => {
    const chosen = weakestTopic(
      [],
      [
        problem({ slug: 'a1', topic: 'arrays', status: 'solved' }),
        problem({ slug: 'a2', topic: 'arrays' }),
        problem({ slug: 'g1', topic: 'graph' }),
        problem({ slug: 'g2', topic: 'graph' }),
      ],
    );

    // Arrays is half done, graph is untouched.
    expect(chosen?.topic).toBe('graph');
    // And it says which signal it used, so the suggestion is not mistaken for
    // a judgement about how well the user did.
    expect(chosen?.reason).toContain('not scored anything yet');
  });

  it('ignores a topic that is entirely finished in the fallback too', () => {
    const chosen = weakestTopic(
      [],
      [
        problem({ slug: 'a1', topic: 'arrays', status: 'mastered' }),
        problem({ slug: 'g1', topic: 'graph' }),
      ],
    );

    expect(chosen?.topic).toBe('graph');
  });

  it('has nothing to say when everything is solved', () => {
    expect(weakestTopic([], [problem({ status: 'solved' })])).toBeNull();
    expect(weakestTopic([], [])).toBeNull();
  });
});
