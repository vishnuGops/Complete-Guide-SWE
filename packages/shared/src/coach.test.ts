import { describe, it, expect } from 'vitest';
import {
  COACH_SKIP_MESSAGE,
  COACH_SKIP_REASONS,
  HINT_LEVELS,
  MASTERY_THRESHOLD,
  MAX_RUBRIC_SCORE,
  RUBRIC_DIMENSIONS,
  coachFeedbackRequestSchema,
  coachFeedbackSchema,
  hintLevelRank,
  meetsMastery,
} from './coach.js';

const perfectScores = {
  correctness: 4,
  timeComplexity: 4,
  spaceComplexity: 4,
  edgeCases: 4,
  readability: 4,
} as const;

describe('meetsMastery', () => {
  it('passes only when every dimension meets the threshold', () => {
    expect(meetsMastery(perfectScores)).toBe(true);
  });

  it.each(RUBRIC_DIMENSIONS)('fails when %s is one short', (dimension) => {
    const scores = { ...perfectScores, [dimension]: MASTERY_THRESHOLD - 1 };
    expect(meetsMastery(scores)).toBe(false);
  });

  it('keeps the threshold reachable on the declared scale', () => {
    expect(MASTERY_THRESHOLD).toBeLessThanOrEqual(MAX_RUBRIC_SCORE);
  });
});

describe('hint ladder', () => {
  it('escalates from nudge to full solution', () => {
    expect(HINT_LEVELS[0]).toBe('nudge');
    expect(HINT_LEVELS.at(-1)).toBe('solution');
    for (let i = 1; i < HINT_LEVELS.length; i += 1) {
      expect(hintLevelRank(HINT_LEVELS[i]!)).toBeGreaterThan(hintLevelRank(HINT_LEVELS[i - 1]!));
    }
  });
});

describe('coachFeedbackSchema', () => {
  const base = {
    summary: 'Correct, but the inner scan makes this quadratic.',
    scores: { ...perfectScores, timeComplexity: 1 },
    feedbackMarkdown: 'Your loop on line 7 rescans the prefix each iteration.',
    mastered: false,
  };

  it('defaults nextHintLevel to null', () => {
    expect(coachFeedbackSchema.parse(base).nextHintLevel).toBeNull();
  });

  it('rejects a score outside the rubric scale', () => {
    expect(
      coachFeedbackSchema.safeParse({
        ...base,
        scores: { ...perfectScores, correctness: MAX_RUBRIC_SCORE + 1 },
      }).success,
    ).toBe(false);
    expect(
      coachFeedbackSchema.safeParse({ ...base, scores: { ...perfectScores, correctness: -1 } })
        .success,
    ).toBe(false);
  });

  it('rejects a partial rubric, so the dashboard never sees a gap', () => {
    const { readability: _omitted, ...partial } = perfectScores;
    expect(coachFeedbackSchema.safeParse({ ...base, scores: partial }).success).toBe(false);
  });

  it('rejects empty feedback', () => {
    expect(coachFeedbackSchema.safeParse({ ...base, feedbackMarkdown: '' }).success).toBe(false);
    expect(coachFeedbackSchema.safeParse({ ...base, summary: '' }).success).toBe(false);
  });

  it('rejects an unknown hint level', () => {
    expect(coachFeedbackSchema.safeParse({ ...base, nextHintLevel: 'answer' }).success).toBe(false);
  });
});

describe('coachFeedbackRequestSchema', () => {
  const base = { slug: 'two-sum', language: 'python', code: 'class Solution: ...' };

  it('defaults the flags that must be opt-in', () => {
    const parsed = coachFeedbackRequestSchema.parse(base);
    expect(parsed.revealedHints).toBe(0);
    expect(parsed.masteryCheck).toBe(false);
    expect(parsed.requestFullSolution).toBe(false);
  });

  it('rejects empty code: the local pre-check should have caught it first', () => {
    expect(coachFeedbackRequestSchema.safeParse({ ...base, code: '' }).success).toBe(false);
  });
});

describe('skip reasons', () => {
  it('has user-facing copy for every reason', () => {
    for (const reason of COACH_SKIP_REASONS) {
      expect(COACH_SKIP_MESSAGE[reason].length).toBeGreaterThan(0);
    }
  });
});
