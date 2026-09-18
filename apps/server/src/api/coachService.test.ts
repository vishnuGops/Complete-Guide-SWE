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
  newConversation: false,
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
    // `output_config` itself carries the effort level (P5-9); what a prose turn
    // must not carry is a response format.
    expect(JSON.parse(requests[0]!)).not.toHaveProperty('output_config.format');
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

describe('attempt memory (P5-5)', () => {
  /** Two turns, with the code changed in between. */
  async function twoTurns(second: string) {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    await collect(streamFeedback(feedbackRequest({ code: second }), deps(fetch)));
    return requests[1]!;
  }

  it('tells the coach what changed since its last feedback', async () => {
    const revised = ATTEMPT.replace('        return [0, 1]', '        return [1, 0]');
    const sent = await twoTurns(revised);

    expect(sent).toContain('Changed since that feedback');
    expect(sent).toContain('return [0, 1]');
    expect(sent).toContain('return [1, 0]');
  });

  it('says so when the user asked again without changing anything', async () => {
    // The most useful thing the delta produces: someone asking twice on the
    // same code is stuck, and the coach should try a different angle.
    const sent = await twoTurns(ATTEMPT);

    expect(sent).toContain('has not changed');
    expect(sent).toContain('different angle');
  });

  it('stores the code the feedback was about', async () => {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    const session = repos.coach.latestSession(SLUG, 'python');
    const messages = repos.coach.listMessages(session!.id);
    const coachTurn = messages.find((m) => m.feedback !== null);

    expect(coachTurn?.code).toBe(ATTEMPT);
  });

  it('still remembers a turn recorded before the code column existed', async () => {
    // Rows written by P5-3 have no code. The feedback is still worth carrying,
    // so the delta is the part that goes missing, not the whole attempt.
    const session = repos.coach.createSession(SLUG, 'python');
    repos.coach.addMessage(session.id, {
      role: 'coach',
      content: 'older feedback',
      feedback: { ...ANSWER, summary: 'OLDER-SUMMARY' },
    });

    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    expect(requests[0]).toContain('OLDER-SUMMARY');
    expect(requests[0]).not.toContain('Changed since that feedback');
  });
});

describe('the spend cap (P5-6)', () => {
  /** An Anthropic stream that also reports usage, as a real one does. */
  function withUsage(inputTokens: number, outputTokens: number): string {
    return [
      `event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: 'm',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: inputTokens, output_tokens: 0 },
        },
      })}\n\n`,
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: JSON.stringify(ANSWER) },
      })}\n\n`,
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
      `event: message_delta\ndata: ${JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: outputTokens },
      })}\n\n`,
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ].join('');
  }

  function setCap(capUsd: number | null) {
    repos.settings.update({ coach: { spendCapUsd: capUsd } });
  }

  it('records what a turn cost, from the vendor’s own token counts', async () => {
    const fetch = providerFetch(withUsage(1_000_000, 0));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    const session = repos.coach.latestSession(SLUG, 'python')!;
    // A million input tokens on the default model (claude-opus-5) is $5 by the
    // shared price table - not the unknown-model rate, because a null model in
    // settings resolves to a specific default rather than to "unknown".
    expect(repos.coach.sessionSpend(session.id).reportedUsd).toBeCloseTo(5);
  });

  it('lets a turn through while the conversation is under the cap', async () => {
    setCap(10);
    const fetch = providerFetch(withUsage(1_000_000, 0));
    const events = await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    expect(events.some((e) => e.type === 'done')).toBe(true);
  });

  it('refuses the next turn once the cap is reached, without calling the provider', async () => {
    setCap(1);
    const fetch = providerFetch(withUsage(1_000_000, 0));

    await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    expect(requests).toHaveLength(1);

    const second = await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    expect(second[0]).toMatchObject({ type: 'skipped', reason: 'spend_cap_reached' });
    // The point of a cap: the refusal costs nothing.
    expect(requests).toHaveLength(1);
  });

  it('does nothing when no cap is set', async () => {
    setCap(null);
    const fetch = providerFetch(withUsage(1_000_000, 0));

    await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    const second = await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    expect(second.some((e) => e.type === 'done')).toBe(true);
  });

  it('treats a turn the vendor reported nothing for as unknown, not free', async () => {
    // Zero counts mean "not reported", which must not be recorded as $0 - that
    // would let an unmetered turn look like a free one to the cap.
    const fetch = providerFetch(withUsage(0, 0));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));

    const session = repos.coach.latestSession(SLUG, 'python')!;
    const coachTurn = repos.coach.listMessages(session.id).find((m) => m.feedback !== null);
    expect(coachTurn?.costUsd).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The money path (ROADMAP P5-9)
// ---------------------------------------------------------------------------

/** A prose reply with a usage report, for the chat cost tests. */
function proseWithUsage(inputTokens: number): string {
  return [
    `event: message_start\ndata: ${JSON.stringify({
      type: 'message_start',
      message: {
        id: 'm',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: inputTokens, output_tokens: 0 },
      },
    })}\n\n`,
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    `event: content_block_delta\ndata: ${JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Because the map is never read.' },
    })}\n\n`,
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":0}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ].join('');
}

/** Input tokens reported, then a stream that never ends on its own. */
function hangingFetch(inputTokens = 1_000_000): FetchLike {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(typeof init?.body === 'string' ? init.body : '');
    const signal = init?.signal ?? null;
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `event: message_start\ndata: ${JSON.stringify({
              type: 'message_start',
              message: {
                id: 'm',
                type: 'message',
                role: 'assistant',
                model: 'claude-opus-5',
                content: [],
                stop_reason: null,
                stop_sequence: null,
                usage: { input_tokens: inputTokens, output_tokens: 0 },
              },
            })}\n\n`,
          ),
        );
        controller.enqueue(
          encoder.encode(
            'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            `event: content_block_delta\ndata: ${JSON.stringify({
              type: 'content_block_delta',
              index: 0,
              delta: { type: 'text_delta', text: '{"feedbackMarkdown":"half' },
            })}\n\n`,
          ),
        );
        // Deliberately no terminator: the only way out of this turn is the
        // signal, which is the situation the audit found nothing produced.
        signal?.addEventListener('abort', () => {
          controller.error(new DOMException('aborted', 'AbortError'));
        });
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }) as FetchLike;
}

describe('cancellation', () => {
  /** Drives a turn until the first markdown arrives, then cancels it. */
  async function askAndCancel(): Promise<CoachStreamEvent[]> {
    const controller = new AbortController();
    const events = streamFeedback(feedbackRequest(), deps(hangingFetch()), controller.signal);
    const seen: CoachStreamEvent[] = [];

    for await (const event of events) {
      seen.push(event);
      if (event.type === 'markdown') {
        // What the route does when the browser disconnects.
        controller.abort();
        await events.return(undefined);
        break;
      }
    }

    return seen;
  }

  it('stops on the signal without reporting an error', async () => {
    const seen = await askAndCancel();

    expect(seen.some((e) => e.type === 'start')).toBe(true);
    expect(seen.some((e) => e.type === 'markdown')).toBe(true);
    // Nothing went wrong: the user cancelled, and there is nobody left to read
    // an error frame anyway.
    expect(seen.some((e) => e.type === 'error')).toBe(false);
  });

  it('records what the cancelled turn spent, and stores no answer', async () => {
    await askAndCancel();

    const session = repos.coach.latestSession(SLUG, 'python')!;
    const messages = repos.coach.listMessages(session.id);

    // One row - the context the turn opened with - now carrying the cost the
    // vendor reported before it was cut off. Recording nothing would have made
    // Stop a free way to spend money.
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('user');
    expect(messages[0]?.costUsd).toBeCloseTo(5);
    expect(messages.some((m) => m.feedback !== null)).toBe(false);
  });

  it('counts a turn nobody could price against the cap', async () => {
    // Nothing reported at all: the row is unpriced, and the cap charges it at
    // the dearest rate known for the provider rather than at zero.
    const controller = new AbortController();
    const events = streamFeedback(feedbackRequest(), deps(hangingFetch(0)), controller.signal);
    for await (const event of events) {
      if (event.type === 'markdown') {
        controller.abort();
        await events.return(undefined);
        break;
      }
    }

    const session = repos.coach.latestSession(SLUG, 'python')!;
    expect(repos.coach.sessionSpend(session.id)).toEqual({
      reportedUsd: 0,
      unreportedTurns: 1,
    });
  });
});

describe('streamChat, under the same cap as feedback', () => {
  async function seedConversation(): Promise<string> {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    return repos.coach.latestSession(SLUG, 'python')!.id;
  }

  it('refuses a follow-up once the conversation has reached the cap', async () => {
    const sessionId = await seedConversation();
    // Priced by hand: what is under test is the check in chat, not how the
    // figure got there.
    const feedbackTurn = repos.coach.listMessages(sessionId).find((m) => m.feedback !== null)!;
    repos.coach.setMessageCost(feedbackTurn.id, 9);
    repos.settings.update({ coach: { spendCapUsd: 1 } });

    const before = requests.length;
    const events = await collect(
      streamChat({ sessionId, message: 'Why?' }, deps(providerFetch('{}'))),
    );

    expect(events[0]).toMatchObject({ type: 'skipped', reason: 'spend_cap_reached' });
    // The bug this closes: follow-ups were the way around a tripped cap.
    expect(requests).toHaveLength(before);
  });

  it('records what a follow-up cost', async () => {
    const sessionId = await seedConversation();
    await collect(
      streamChat({ sessionId, message: 'Why?' }, deps(providerFetch(proseWithUsage(1_000_000)))),
    );

    const reply = repos.coach.listMessages(sessionId).at(-1);
    expect(reply?.role).toBe('coach');
    expect(reply?.costUsd).toBeCloseTo(5);
  });

  it('leaves a failed follow-up as a question with no answer claimed', async () => {
    const sessionId = await seedConversation();
    await collect(streamChat({ sessionId, message: 'Why?' }, deps(providerFetch('{}', 500))));

    const messages = repos.coach.listMessages(sessionId);
    expect(messages.filter((m) => m.content === 'Why?')).toHaveLength(1);
    expect(messages.at(-1)?.role).toBe('user');
  });

  it('sends the latest feedback context and the turns after it, not every context', async () => {
    const sessionId = await seedConversation();
    // A second review in the same conversation; its context becomes the start
    // of the window (D20).
    await collect(
      streamFeedback(
        feedbackRequest({ code: `${ATTEMPT}\n        # second attempt\n` }),
        deps(providerFetch(anthropicStream(JSON.stringify(ANSWER)))),
      ),
    );

    requests.length = 0;
    await collect(
      streamChat({ sessionId, message: 'And now?' }, deps(providerFetch(proseWithUsage(10)))),
    );

    const body = JSON.parse(requests[0]!) as { messages: { content: string }[] };
    // Every feedback context opens with the Problem section, so counting that
    // counts contexts - one per review before the window, one after it.
    const contexts = body.messages.filter((m) => m.content.includes('Title: '));
    const withSecond = body.messages.filter((m) => m.content.includes('# second attempt'));

    // Exactly one context, the latest, not one per review. This is what stopped
    // the eighth follow-up costing eight times the first.
    expect(contexts).toHaveLength(1);
    expect(withSecond).toHaveLength(1);
    expect(body.messages.at(-1)?.content).toBe('And now?');
  });
});

/** A full feedback answer with a usage report, at module scope (P5-9). */
function feedbackWithUsage(inputTokens: number): string {
  const stream = anthropicStream(JSON.stringify(ANSWER));
  return stream.replace(
    '"usage":{"input_tokens":1,"output_tokens":1}',
    `"usage":{"input_tokens":${String(inputTokens)},"output_tokens":0}`,
  );
}

describe('new conversation', () => {
  it('starts a second session rather than continuing the first', async () => {
    const fetch = providerFetch(anthropicStream(JSON.stringify(ANSWER)));
    await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    const first = repos.coach.latestSession(SLUG, 'python')!;

    await collect(streamFeedback(feedbackRequest({ newConversation: true }), deps(fetch)));
    const second = repos.coach.latestSession(SLUG, 'python')!;

    expect(second.id).not.toBe(first.id);
  });

  it('is the way out of a tripped spend cap', async () => {
    const fetch = providerFetch(feedbackWithUsage(1_000_000));
    repos.settings.update({ coach: { spendCapUsd: 1 } });

    await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    const refused = await collect(streamFeedback(feedbackRequest(), deps(fetch)));
    expect(refused[0]).toMatchObject({ type: 'skipped', reason: 'spend_cap_reached' });

    const fresh = await collect(
      streamFeedback(feedbackRequest({ newConversation: true }), deps(fetch)),
    );
    expect(fresh.some((e) => e.type === 'done')).toBe(true);
  });
});
