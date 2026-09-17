import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COACH_API_KEY_ENV, type CoachFeedback, type CoachStreamEvent } from '@devpromax/shared';
import type { FetchLike } from '../coach/index.js';
import { createCatalogue, type Catalogue } from './catalogue.js';
import { streamChat, streamFeedback, type CoachServiceDeps } from './coachService.js';
import { createDatabase, IN_MEMORY, type Repositories } from '../db/index.js';
import { makeCatalogue, writeProblem } from '../problems/__fixtures__/factory.js';

/**
 * The coaching turn (ROADMAP P5-3, D13).
 *
 * The provider is stood in for with a recorded event stream, so every decision
 * this service makes - refuse locally, refuse for want of a key, persist, map an
 * error - is tested without a network and without an HTTP server. The route
 * tests only have to prove the frames reach the socket.
 *
 * The most important assertions here are the negative ones: that the request is
 * *not* made. A coach that quietly calls a vendor when the editor still holds
 * the starter costs the user money to be told they have not started.
 */

const SLUG = 'pair-sum-index';

/** The fixture's own Python starter, which the pre-check compares against. */
const STARTER =
  'from typing import List\n\n\nclass Solution:\n    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:\n        pass\n';

const ATTEMPT = STARTER.replace('        pass', '        seen = {}\n        return [0, 1]');

const ANSWER: CoachFeedback = {
  summary: 'Returns a constant pair.',
  scores: {
    correctness: 1,
    timeComplexity: 3,
    spaceComplexity: 3,
    edgeCases: 1,
    readability: 3,
  },
  feedbackMarkdown: 'Your `seen` map is never read.\n\nYou return `[0, 1]` regardless of input.',
  nextHintLevel: 'nudge',
  nextStep: 'Look up the complement in `seen` before inserting.',
  mastered: false,
};

let repos: Repositories;
let catalogue: Catalogue;
let root: string;
/** Every request body the stand-in provider was given, for the negative tests. */
let requests: string[];

/** Replays a recorded Anthropic event stream; the SDK parses it as it would a real one. */
function providerFetch(body: string, status = 200): FetchLike {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(typeof init?.body === 'string' ? init.body : '');
    if (status !== 200) return new Response('{}', { status });
    return new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }) as FetchLike;
}

function anthropicStream(text: string): string {
  return [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"m","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}}\n\n',
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    `event: content_block_delta\ndata: ${JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    })}\n\n`,
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":9}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ].join('');
}

function deps(fetch: FetchLike, env: NodeJS.ProcessEnv = { [COACH_API_KEY_ENV]: 'k' }) {
  return { repos, catalogue, env, provider: { fetch } } satisfies CoachServiceDeps;
}

async function collect(events: AsyncGenerator<CoachStreamEvent>): Promise<CoachStreamEvent[]> {
  const out: CoachStreamEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

const feedbackRequest = (overrides: Record<string, unknown> = {}) => ({
  slug: SLUG,
  language: 'python' as const,
  code: ATTEMPT,
  revealedHints: 0,
  masteryCheck: false,
  requestFullSolution: false,
  ...overrides,
});

beforeEach(() => {
  root = makeCatalogue();
  writeProblem(root, { topic: 'arrays', slug: SLUG });
  repos = createDatabase({ file: IN_MEMORY });
  catalogue = createCatalogue({ root, cache: false });
  requests = [];
});

afterEach(() => {
  repos.close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('streamFeedback', () => {
  it('streams markdown and ends with the validated feedback', async () => {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    const events = await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    expect(events[0]).toMatchObject({ type: 'start' });
    const markdown = events
      .filter((e) => e.type === 'markdown')
      .map((e) => e.delta)
      .join('');
    expect(markdown).toBe(ANSWER.feedbackMarkdown);
    expect(events.at(-1)).toEqual({ type: 'done', feedback: ANSWER });
  });

  it('refuses the untouched starter without calling the provider', async () => {
    const fetch = providerFetch(anthropicStream('{}'));
    const events = await collect(streamFeedback(feedbackRequest({ code: STARTER }), deps(fetch)));

    expect(events).toEqual([
      {
        type: 'skipped',
        reason: 'unchanged_starter',
        message: 'Write some code first, then ask for help.',
      },
    ]);
    // The whole point of the pre-check: nothing was spent finding this out.
    expect(requests).toHaveLength(0);
  });

  it('refuses a body with no solution in it without calling the provider', async () => {
    const fetch = providerFetch(anthropicStream('{}'));
    const emptied = 'class Solution:\n    def pairSumIndex(self, nums, target):\n        pass';
    const events = await collect(streamFeedback(feedbackRequest({ code: emptied }), deps(fetch)));

    expect(events[0]).toMatchObject({ type: 'skipped', reason: 'no_meaningful_code' });
    expect(requests).toHaveLength(0);
  });

  it('refuses without a key, and says where to put one', async () => {
    const fetch = providerFetch(anthropicStream('{}'));
    const events = await collect(streamFeedback(feedbackRequest(), deps(fetch, {})));

    expect(events[0]).toMatchObject({ type: 'skipped', reason: 'no_api_key' });
    expect(events[0]).toMatchObject({ message: expect.stringContaining('Settings') as string });
    expect(requests).toHaveLength(0);
  });

  it('checks the pre-check before the key, so the cheaper answer wins', async () => {
    // Someone with no key who has also not started should be told to write
    // code, not sent to Settings for a key they do not yet need.
    const fetch = providerFetch(anthropicStream('{}'));
    const events = await collect(
      streamFeedback(feedbackRequest({ code: STARTER }), deps(fetch, {})),
    );

    expect(events[0]).toMatchObject({ reason: 'unchanged_starter' });
  });

  it('persists the turn so the panel survives a reload', async () => {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    const session = repos.coach.latestSession(SLUG, 'python');
    expect(session).not.toBeNull();

    const messages = repos.coach.listMessages(session!.id);
    expect(messages.map((m) => m.role)).toEqual(['user', 'coach']);
    expect(messages[1]?.feedback).toEqual(ANSWER);
  });

  it('carries earlier feedback into the next request (P5-5)', async () => {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    expect(requests[1]).toContain('Prior coaching on this problem');
    expect(requests[1]).toContain(ANSWER.summary);
    // The first request had nothing to remember.
    expect(requests[0]).not.toContain('Prior coaching on this problem');
  });

  it('tells the coach the problem is unsolved, so the solution rung stays shut', async () => {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    await collect(streamFeedback(feedbackRequest({ requestFullSolution: true }), deps(fetch)));

    expect(requests[0]).toContain('Problem already solved by this user: no');
    expect(requests[0]).toContain('User explicitly asked for the full solution: yes');
  });

  it('sends only the hint rungs the user has actually read', async () => {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    await collect(streamFeedback(feedbackRequest({ revealedHints: 1 }), deps(fetch)));

    expect(requests[0]).toContain('Think about complements.');
    expect(requests[0]).not.toContain('Use a map.');
  });

  it('turns a refused key into an error event, not a crash', async () => {
    const events = await collect(streamFeedback(feedbackRequest(), deps(providerFetch('', 401))));

    const error = events.find((e) => e.type === 'error');
    expect(error).toMatchObject({ retryable: false });
    expect(error?.type === 'error' && error.message).toMatch(/rejected that API key/i);
  });

  it('marks a rate limit retryable so the panel can offer to try again', async () => {
    const events = await collect(streamFeedback(feedbackRequest(), deps(providerFetch('', 429))));

    expect(events.find((e) => e.type === 'error')).toMatchObject({ retryable: true });
  });

  it('reports an answer of the wrong shape without persisting it', async () => {
    const fetch = providerFetch(anthropicStream('{"summary":"hi"}'));
    const events = await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    expect(events.find((e) => e.type === 'error')).toMatchObject({ retryable: false });

    const session = repos.coach.latestSession(SLUG, 'python');
    // The user turn is there; nothing was written as coach feedback.
    expect(repos.coach.listMessages(session!.id).map((m) => m.role)).toEqual(['user']);
  });

  it('rejects an unknown slug before opening a stream', async () => {
    const fetch = providerFetch(anthropicStream('{}'));
    await expect(
      collect(streamFeedback(feedbackRequest({ slug: 'no-such-problem' }), deps(fetch))),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('streamChat', () => {
  async function startSession(): Promise<string> {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    const events = await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    const start = events.find((e) => e.type === 'start');
    return start?.type === 'start' ? start.sessionId : '';
  }

  it('answers in prose, without asking for a schema', async () => {
    const sessionId = await startSession();
    requests = [];

    const fetch = providerFetch(anthropicStream('Because the map is never read.'));
    const events = await collect(
      streamChat({ sessionId, message: 'Why is it wrong?' }, deps(fetch)),
    );

    expect(events.at(-1)).toEqual({ type: 'reply', content: 'Because the map is never read.' });
    // A schema here would make a one-line answer arrive quoted and escaped.
    expect(JSON.parse(requests[0]!)).not.toHaveProperty('output_config');
  });

  it('sends the conversation so far, so a follow-up has something to follow', async () => {
    const sessionId = await startSession();
    requests = [];

    const fetch = providerFetch(anthropicStream('Yes.'));
    await collect(streamChat({ sessionId, message: 'Is that the only bug?' }, deps(fetch)));

    const sent = JSON.parse(requests[0]!) as { messages: { role: string; content: string }[] };
    expect(sent.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(sent.messages.at(-1)?.content).toBe('Is that the only bug?');
  });

  it('persists both halves of the exchange', async () => {
    const sessionId = await startSession();
    const fetch = providerFetch(anthropicStream('Yes.'));
    await collect(streamChat({ sessionId, message: 'Is that the only bug?' }, deps(fetch)));

    expect(repos.coach.listMessages(sessionId).map((m) => m.role)).toEqual([
      'user',
      'coach',
      'user',
      'coach',
    ]);
  });

  it('rejects a session that no longer exists', async () => {
    const fetch = providerFetch(anthropicStream('x'));
    await expect(
      collect(
        streamChat(
          { sessionId: '00000000-0000-4000-8000-000000000000', message: 'hi' },
          deps(fetch),
        ),
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('mastery (P5-4, D11)', () => {
  const perfect = {
    ...ANSWER,
    scores: {
      correctness: 4,
      timeComplexity: 4,
      spaceComplexity: 4,
      edgeCases: 4,
      readability: 4,
    },
    mastered: true,
  };

  /** Puts the problem in the state an accepted submit would leave it. */
  function markSolved() {
    repos.progress.put({
      slug: SLUG,
      language: 'python',
      status: 'solved',
      attempts: 1,
      solvedAt: '2026-09-17T00:00:00.000Z',
      masteredAt: null,
      lastAttemptedAt: '2026-09-17T00:00:00.000Z',
    });
  }

  async function ask(feedback: unknown) {
    const fetch = providerFetch(anthropicStream(JSON.stringify(feedback)));
    await collect(streamFeedback(feedbackRequest({ masteryCheck: true }), deps(fetch)));
    return repos.progress.get(SLUG, 'python');
  }

  it('promotes a solved problem when the coach and the scores agree', async () => {
    markSolved();
    const after = await ask(perfect);

    expect(after?.status).toBe('mastered');
    expect(after?.masteredAt).not.toBeNull();
  });

  it('refuses to promote code the judge has never accepted', async () => {
    // No solved row: the rubric is a judgement about something unproven.
    const after = await ask(perfect);
    expect(after?.status).not.toBe('mastered');
  });

  it('refuses to promote when the flag disagrees with the scores', async () => {
    // The flag is a claim and the scores are the evidence; disagreement
    // resolves against the claim.
    markSolved();
    const after = await ask({
      ...perfect,
      scores: { ...perfect.scores, edgeCases: 2 },
      mastered: true,
    });

    expect(after?.status).toBe('solved');
  });

  it('does not demote on a failed check', async () => {
    markSolved();
    const after = await ask({ ...ANSWER, mastered: false });

    // Declining to promote is not grounds to take away a status already earned.
    expect(after?.status).toBe('solved');
    expect(after?.attempts).toBe(1);
  });

  it('does not count a coaching turn as an attempt', async () => {
    markSolved();
    const after = await ask(perfect);
    expect(after?.attempts).toBe(1);
  });
});
