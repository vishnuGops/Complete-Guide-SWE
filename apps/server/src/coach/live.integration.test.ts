import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COACH_PROVIDERS, coachFeedbackSchema, type CoachProvider } from '@devpromax/shared';
import {
  createCoachProvider,
  followUpPrompt,
  interviewerPrompt,
  streamCoachFeedback,
  systemPrompt,
  type CoachProvider as CoachAdapter,
  type StreamOptions,
} from './index.js';
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
 * Run it before bumping the prompt version. On the default model it costs about
 * a dollar and a few minutes (the rubric fixtures are most of that), and it is
 * the only way to find out that `v3` scores every dimension 4, or that a vendor
 * started rejecting a field we send, before a user does. The step-by-step, with
 * a cheap first pass, is `docs/API_KEY_TESTING.md`.
 */

const LIVE = process.env['COACH_LIVE_TESTS'] === '1';

const KEY_ENV: Record<CoachProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  // There is no vendor behind this one, so there is no key to have (P9-4); the
  // endpoint is whatever `DEVPROMAX_COACH_BASE_URL` points at, and the local
  // servers it is for want no key at all.
  'openai-compatible': 'OPENAI_COMPATIBLE_API_KEY',
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

/** A review of `CODE`, as a coach turn would have stored it, for the follow-up case. */
const REVIEW =
  'The nested loop over `nums` is O(n^2), and n goes to 10^5 here, so it will time out. ' +
  'It also pairs an index with itself when `nums[i] * 2 == target`.';

/** Everything a prose turn streamed, in one string. */
async function prose(adapter: CoachAdapter, options: StreamOptions): Promise<string> {
  let text = '';
  for await (const chunk of adapter.stream(options)) text += chunk;
  return text;
}

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

      /*
       * A follow-up, the way `streamChat` sends one (ROADMAP P5-12, P5-13):
       * the rubric prompt, the follow-up block after it, the review as cached
       * history, and a question. What only a vendor can say: that this request
       * shape is accepted - two system blocks, a breakpoint on a history turn,
       * low effort, no schema - and that the answer comes back as prose.
       */
      it('answers a follow-up in prose, without a schema', { timeout: 120_000 }, async () => {
        const reply = await prose(createCoachProvider(provider), {
          apiKey: apiKey!,
          model: null,
          system: systemPrompt(),
          instructions: followUpPrompt(),
          messages: [
            { role: 'user', content: CONTEXT },
            { role: 'coach', content: REVIEW, cacheBreakpoint: true },
            { role: 'user', content: 'Why does the same index get used twice?' },
          ],
        });

        expect(reply.trim().length).toBeGreaterThan(0);
        // The failure the follow-up block exists for: a scored JSON document
        // in answer to a one-line question.
        expect(reply.trim().startsWith('{')).toBe(false);
        expect(reply).not.toMatch(/"scores"\s*:/);
      });

      /*
       * One interviewer turn at the approach stage (ROADMAP P9-1, P5-12). The
       * interviewer must not hand the approach over, and a line of code in its
       * answer is the plainest sign that it did.
       */
      it('asks rather than tells, as the interviewer', { timeout: 120_000 }, async () => {
        const reply = await prose(createCoachProvider(provider), {
          apiKey: apiKey!,
          model: null,
          system: interviewerPrompt(),
          messages: [
            {
              role: 'user',
              content: [
                'Stage: approach. They have the statement and have not written code yet. Get their approach in words and push on it before they start.',
                'Time: 44 minute(s) left of 45.',
                '',
                'The problem they are on:',
                'Given a list of integers and a target, return the indices of the two distinct entries that sum to it. n goes up to 10^5.',
                '',
                '---',
                '',
                'The candidate says:',
                '',
                'I would check every pair with two loops.',
              ].join('\n'),
            },
          ],
        });

        expect(reply.trim().length).toBeGreaterThan(0);
        expect(reply).not.toMatch(/```/);
        // Short turns, one question at a time.
        expect(reply.length).toBeLessThan(1_500);
      });
    });
  }
});

/**
 * A model without adaptive thinking (ROADMAP P5-11).
 *
 * Haiku 4.5 refuses `thinking: {type: 'adaptive'}` and `effort` with a 400, and
 * the capability map is what keeps them off its requests. A recorded fixture
 * can only show that they are left off; this shows the vendor agrees that
 * what is left is a request it accepts - schema included.
 */
describe.skipIf(!LIVE || !process.env[KEY_ENV.anthropic])('anthropic on Haiku 4.5', () => {
  it('reviews without thinking, in the required shape', { timeout: 300_000 }, async () => {
    let feedback: unknown;
    for await (const chunk of streamCoachFeedback(createCoachProvider('anthropic'), {
      apiKey: process.env[KEY_ENV.anthropic]!,
      model: 'claude-haiku-4-5',
      system: systemPrompt(),
      messages: [{ role: 'user', content: CONTEXT }],
    })) {
      if (chunk.type === 'done') feedback = chunk.feedback;
    }

    expect(coachFeedbackSchema.parse(feedback).mastered).toBe(false);
  });
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
