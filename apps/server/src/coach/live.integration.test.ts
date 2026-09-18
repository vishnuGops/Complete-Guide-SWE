import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COACH_PROVIDERS, coachFeedbackSchema, type CoachProvider } from '@devpromax/shared';
import { createCoachProvider, streamCoachFeedback, systemPrompt } from './index.js';
import { PROMPT_VERSION } from './prompts/index.js';
import { RUBRIC_CASES, rubricContext, rungRank } from './__fixtures__/rubric.js';

/**
 * The one thing no other test can prove (ROADMAP P5-10, and the gap M2 left).
 *
 * Every other coach test replays a recorded stream, because CI has no keys and
 * must not depend on a vendor being up (D17). What none of them can tell you is
 * whether the request this app builds is one the vendor actually accepts, or
 * whether a real model answers the current prompt in the shape the schema
 * requires. Those are exactly the things a prompt edit breaks.
 *
 * **It is off unless asked for.** `COACH_LIVE_TESTS=1` plus a key for the
 * provider under test:
 *
 *   COACH_LIVE_TESTS=1 ANTHROPIC_API_KEY=sk-... npm run test:integration
 *   COACH_LIVE_TESTS=1 GEMINI_API_KEY=... npm run test:integration
 *
 * Run it before bumping the prompt version. It costs a few cents and a minute,
 * and it is the only way to find out that `v3` scores every dimension 4, or
 * that a vendor started rejecting a field we send, before a user does.
 */

const LIVE = process.env['COACH_LIVE_TESTS'] === '1';

const KEY_ENV: Record<CoachProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
};

/** A real attempt with two real defects, so a 4 across the board is a red flag. */
const CODE = [
  'from typing import List',
  '',
  '',
  'class Solution:',
  '    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:',
  '        # Quadratic, and wrong when the same index would be used twice.',
  '        for i in range(len(nums)):',
  '            for j in range(len(nums)):',
  '                if nums[i] + nums[j] == target:',
  '                    return [i, j]',
  '        return []',
  '',
].join('\n');

const CONTEXT = [
  '## Problem',
  'Title: Pair Sum Index',
  'Topic: arrays',
  'Difficulty: Easy (rating 2/10)',
  'Target complexity: time O(n), space O(n)',
  '',
  '## Statement',
  'Given a list of integers and a target, return the indices of the two',
  'distinct entries that sum to it. n goes up to 10^5.',
  '',
  "## The user's code (python)",
  '```python',
  CODE,
  '```',
  '',
  '## Latest judge result',
  'Verdict: WA. 1 of 12 tests passed.',
].join('\n');

describe.skipIf(!LIVE)(`the coach against a live vendor (prompt ${PROMPT_VERSION})`, () => {
  beforeAll(() => {
    // Named loudly: a suite that spends money must never be a surprise.
    process.stdout.write(
      `\nCOACH_LIVE_TESTS=1: these tests call a vendor and cost money (prompt ${PROMPT_VERSION}).\n`,
    );
  });

  afterAll(() => {
    process.stdout.write('\nLive coach tests finished.\n');
  });

  for (const provider of COACH_PROVIDERS) {
    const apiKey = process.env[KEY_ENV[provider]];

    describe.skipIf(!apiKey)(provider, () => {
      it(
        'answers a real review in the shape the schema requires',
        { timeout: 300_000 },
        async () => {
          const adapter = createCoachProvider(provider);
          const chunks: string[] = [];
          let feedback: unknown;

          for await (const chunk of streamCoachFeedback(adapter, {
            apiKey: apiKey!,
            model: null,
            system: systemPrompt(),
            messages: [{ role: 'user', content: CONTEXT }],
          })) {
            if (chunk.type === 'markdown') chunks.push(chunk.delta);
            else feedback = chunk.feedback;
          }

          const parsed = coachFeedbackSchema.parse(feedback);

          // The prose arrived in pieces, which is the half of P5-1 that only a
          // real stream exercises.
          expect(chunks.length).toBeGreaterThan(1);

          // And the advice is about this code: two real defects are in front of
          // it, so a 4 anywhere here means the prompt has stopped reserving 4.
          expect(parsed.scores.correctness).toBeLessThan(4);
          expect(parsed.scores.timeComplexity).toBeLessThan(4);
          expect(parsed.mastered).toBe(false);
          // The ladder: nothing here is solved, so `solution` is not available.
          expect(parsed.nextHintLevel).not.toBe('solution');
          // And it quotes the user's own code rather than talking in general terms.
          expect(parsed.feedbackMarkdown.toLowerCase()).toMatch(/nums|for |index/);
        },
      );

      it('stops when the request is cancelled', { timeout: 120_000 }, async () => {
        const adapter = createCoachProvider(provider);
        const controller = new AbortController();

        const stream = adapter.stream({
          apiKey: apiKey!,
          model: null,
          system: systemPrompt(),
          messages: [{ role: 'user', content: CONTEXT }],
          signal: controller.signal,
        });

        const iterator = stream[Symbol.asyncIterator]();
        await iterator.next();
        controller.abort();

        // What P5-9 wired up: an aborted turn ends rather than running to
        // completion and billing for an answer nobody reads.
        await expect(iterator.next()).rejects.toThrow();
      });
    });
  }
});

/**
 * Scoring the prompt itself (ROADMAP P5-10).
 *
 * Five code states with what a good coach should say about each - not the
 * wording, which two good reviews never share, but the direction: which
 * dimension cannot be a 4, how far down the ladder this state justifies going,
 * and whether mastery is even on the table.
 *
 * One command, one table of results, before a prompt bump. The assertions are
 * deliberately loose in one direction only: a *more* generous coach fails, a
 * more conservative one does not.
 */
describe.skipIf(!LIVE)(`the rubric fixtures (prompt ${PROMPT_VERSION})`, () => {
  const provider: CoachProvider = process.env['GEMINI_API_KEY'] ? 'gemini' : 'anthropic';
  const apiKey = process.env[KEY_ENV[provider]];

  describe.skipIf(!apiKey)(provider, () => {
    for (const rubricCase of RUBRIC_CASES) {
      it(`scores "${rubricCase.name}" the way the ladder says`, { timeout: 300_000 }, async () => {
        const adapter = createCoachProvider(provider);
        let feedback: unknown;

        for await (const chunk of streamCoachFeedback(adapter, {
          apiKey: apiKey!,
          model: null,
          system: systemPrompt(),
          messages: [{ role: 'user', content: rubricContext(rubricCase) }],
        })) {
          if (chunk.type === 'done') feedback = chunk.feedback;
        }

        const parsed = coachFeedbackSchema.parse(feedback);

        process.stdout.write(
          [
            '',
            `  ${rubricCase.name}`,
            `    scores: ${JSON.stringify(parsed.scores)}`,
            `    rung:   ${String(parsed.nextHintLevel)} (at most ${String(rubricCase.maxRung)})`,
            `    summary: ${parsed.summary}`,
            '',
          ].join('\n'),
        );

        for (const dimension of rubricCase.below4) {
          expect(parsed.scores[dimension], `${dimension} on "${rubricCase.name}"`).toBeLessThan(4);
        }

        // No further down the ladder than the state justifies. The other
        // direction is fine: a coach that gives less than it could is not a bug.
        expect(rungRank(parsed.nextHintLevel)).toBeLessThanOrEqual(rungRank(rubricCase.maxRung));

        if (!rubricCase.masteryPossible) {
          expect(parsed.mastered).toBe(false);
        }
      });
    }
  });
});
