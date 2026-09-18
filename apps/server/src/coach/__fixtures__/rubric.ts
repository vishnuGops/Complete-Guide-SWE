import type { CoachFeedback, HintLevel } from '@devpromax/shared';

/**
 * Five code states for one problem, with what a good coach should say about
 * each (ROADMAP P5-10).
 *
 * This is the closest thing to a test a prompt can have. It cannot assert
 * wording - two good reviews of the same code share almost no sentences - so it
 * asserts *direction*: which dimension must be below 4, which rung is the
 * highest defensible one, and whether mastery is even on the table. A prompt
 * edit that makes the coach generous, or that makes it hand out approaches to
 * someone who only needed a nudge, shows up here as a failed expectation
 * rather than in someone's practice session three weeks later.
 *
 * Driven by `live.integration.test.ts`, which is off unless `COACH_LIVE_TESTS=1`
 * and a key are both set: scoring a prompt means calling a model, and there is
 * no honest way around that.
 *
 * The problem is `pair-sum-index`, because it is the one every other fixture
 * uses and its target complexity is unambiguous: O(n) time, O(n) space.
 */

export interface RubricCase {
  /** What state of mind this code represents. */
  name: string;
  code: string;
  /** What the judge had just said about it, as the context reports it. */
  judge: string;
  /** Dimensions that must not be 4. A generous prompt fails here first. */
  below4: (keyof CoachFeedback['scores'])[];
  /**
   * The furthest down the ladder this state justifies. Anything beyond it is
   * the coach doing the user's thinking for them (D13).
   */
  maxRung: HintLevel | null;
  /** Whether `mastered` could legitimately be true. */
  masteryPossible: boolean;
}

const STARTER = [
  'from typing import List',
  '',
  '',
  'class Solution:',
  '    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:',
  '        pass',
  '',
].join('\n');

export const RUBRIC_CASES: RubricCase[] = [
  {
    name: 'untouched starter',
    code: STARTER,
    judge: 'Verdict: WA. 0 of 12 tests passed.',
    // Nothing has been attempted, so nothing can be interview-ready.
    below4: ['correctness', 'timeComplexity', 'spaceComplexity', 'edgeCases', 'readability'],
    // There is no code to point at, so the lowest useful rung is the idea.
    maxRung: 'concept',
    masteryPossible: false,
  },
  {
    name: 'wrong approach, confidently written',
    code: [
      'from typing import List',
      '',
      '',
      'class Solution:',
      '    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:',
      '        nums.sort()',
      '        return [nums[0], nums[-1]]',
      '',
    ].join('\n'),
    judge: 'Verdict: WA. 1 of 12 tests passed.',
    // It returns values rather than indices, and sorts the caller's list.
    below4: ['correctness', 'edgeCases'],
    maxRung: 'approach',
    masteryPossible: false,
  },
  {
    name: 'correct but quadratic',
    code: [
      'from typing import List',
      '',
      '',
      'class Solution:',
      '    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:',
      '        for i in range(len(nums)):',
      '            for j in range(i + 1, len(nums)):',
      '                if nums[i] + nums[j] == target:',
      '                    return [i, j]',
      '        return []',
      '',
    ].join('\n'),
    judge: 'Verdict: TLE on the largest hidden test. 9 of 12 tests passed.',
    // Right answer, wrong complexity class for n up to 10^5.
    below4: ['timeComplexity'],
    // They have the answer; what they need is the idea that removes the inner
    // loop, not an approach walkthrough.
    maxRung: 'concept',
    masteryPossible: false,
  },
  {
    name: 'right approach, unreadable',
    code: [
      'from typing import List',
      '',
      '',
      'class Solution:',
      '    def pairSumIndex(self, n: List[int], t: int) -> List[int]:',
      '        d = {}',
      '        for x in range(len(n)):',
      '            if t - n[x] in d:',
      '                return [d[t - n[x]], x]',
      '            d[n[x]] = x',
      '        return []',
      '',
    ].join('\n'),
    judge: 'Verdict: AC. 12 of 12 tests passed.',
    below4: ['readability'],
    // Nothing is blocked; a nudge at the naming is the whole review.
    maxRung: 'nudge',
    masteryPossible: false,
  },
  {
    name: 'the reference solution',
    code: [
      'from typing import List',
      '',
      '',
      'class Solution:',
      '    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:',
      '        seen: dict[int, int] = {}',
      '        for index, value in enumerate(nums):',
      '            complement = target - value',
      '            if complement in seen:',
      '                return [seen[complement], index]',
      '            seen[value] = index',
      '        return []',
      '',
    ].join('\n'),
    judge: 'Verdict: AC. 12 of 12 tests passed.',
    below4: [],
    // There is nothing left to unblock.
    maxRung: null,
    masteryPossible: true,
  },
];

/** The context the coach sees, assembled the way `buildContext` assembles one. */
export function rubricContext(rubricCase: RubricCase): string {
  return [
    '## Problem',
    'Title: Pair Sum Index',
    'Topic: arrays',
    'Difficulty: Easy (rating 2/10)',
    'Patterns: hash map',
    'Target complexity: time O(n), space O(n)',
    '',
    '## Statement',
    'Given a list of integers and a target, return the indices of the two',
    'distinct entries that sum to the target. Exactly one such pair exists.',
    'The list holds up to 10^5 integers.',
    '',
    '## Input',
    '',
    '`nums`: the list of integers.',
    '',
    '`target`: the integer to reach.',
    '',
    "## The user's code (python)",
    '```python',
    rubricCase.code,
    '```',
    '',
    '## Latest judge result',
    rubricCase.judge,
  ].join('\n');
}

/** Ladder order, so "no further than this rung" is a comparison. */
export const RUNG_ORDER: HintLevel[] = ['nudge', 'concept', 'approach', 'pseudocode', 'solution'];

export function rungRank(level: HintLevel | null): number {
  return level === null ? -1 : RUNG_ORDER.indexOf(level);
}
