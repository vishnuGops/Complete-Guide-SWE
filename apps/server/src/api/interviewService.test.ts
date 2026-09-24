import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COACH_API_KEY_ENV,
  interviewSchema,
  STAGE_PROMPT,
  type CoachStreamEvent,
  type ProblemSummary,
} from '@devpromax/shared';
import type { FetchLike } from '../coach/index.js';
import { createDatabase, IN_MEMORY, type Repositories } from '../db/index.js';
import { makeCatalogue, writeProblem } from '../problems/__fixtures__/factory.js';
import { createCatalogue, type Catalogue } from './catalogue.js';
import {
  advanceInterview,
  chooseProblems,
  currentInterview,
  finishInterview,
  getInterview,
  INTERVIEWER_STAGE_NOTE,
  sayToInterviewer,
  type InterviewDeps,
} from './interviewService.js';

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

// ---------------------------------------------------------------------------
// The sitting itself (ROADMAP P5-12)
// ---------------------------------------------------------------------------

describe('a sitting, against a stand-in interviewer', () => {
  const SLUG = 'pair-sum-index';

  let repos: Repositories;
  let catalogue: Catalogue;
  let root: string;
  /** Every request body the stand-in vendor was sent. */
  let requests: string[];

  /** A recorded Anthropic stream whose only text is `reply`. */
  function replying(reply: string): FetchLike {
    return (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(typeof init?.body === 'string' ? init.body : '');
      return new Response(
        [
          'event: message_start\ndata: {"type":"message_start","message":{"id":"m","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":1,"output_tokens":1}}}\n\n',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
          `event: content_block_delta\ndata: ${JSON.stringify({
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: reply },
          })}\n\n`,
          'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":9}}\n\n',
          'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        ].join(''),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      );
    }) as FetchLike;
  }

  function deps(fetch: FetchLike = replying('Go on.')): InterviewDeps {
    return { repos, catalogue, env: { [COACH_API_KEY_ENV]: 'k' }, provider: { fetch } };
  }

  async function drain(events: AsyncGenerator<CoachStreamEvent>): Promise<CoachStreamEvent[]> {
    const out: CoachStreamEvent[] = [];
    for await (const event of events) out.push(event);
    return out;
  }

  /** Two problems; the fixture catalogue has one, and asking it twice is fine here. */
  const sitting = () => repos.interviews.create({ slugs: [SLUG, SLUG], budgetMs: 45 * 60_000 });

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

  it('walks both problems to the debrief, and stops there', () => {
    const { id } = sitting();
    const walk = Array.from({ length: 6 }, () => advanceInterview(id, deps()));

    expect(walk.map((view) => [view.at, view.stage])).toEqual([
      [0, 'coding'],
      [0, 'review'],
      [1, 'approach'],
      [1, 'coding'],
      [1, 'review'],
      [2, 'debrief'],
    ]);

    // The double-click on the last review's button. It used to count `at` on
    // past the last problem, to a problem that does not exist.
    const again = advanceInterview(id, deps());
    expect([again.at, again.stage]).toEqual([2, 'debrief']);
    expect(interviewSchema.safeParse(again).success).toBe(true);
  });

  it('tells the interviewer what the stage means for the interviewer', async () => {
    const { id } = sitting();
    await drain(sayToInterviewer(id, 'I would sort it first.', deps()));

    // Its own notes, not the sentence on the candidate's screen - which told
    // it that "the interviewer will push back", about itself.
    expect(requests[0]).toContain(INTERVIEWER_STAGE_NOTE.approach);
    expect(requests[0]).not.toContain(STAGE_PROMPT.approach);
  });

  it('reads the conversation back, oldest first, in the candidate’s own words', async () => {
    const { id } = sitting();
    await drain(
      sayToInterviewer(id, 'I would sort it first.', deps(replying('What does that cost?'))),
    );
    await drain(sayToInterviewer(id, 'O(n log n), for the sort.', deps(replying('Why the sort?'))));

    expect(getInterview(id, deps()).transcript).toEqual([
      // What was typed, not the stage-and-clock preamble sent along with it.
      { from: 'you', text: 'I would sort it first.' },
      { from: 'them', text: 'What does that cost?' },
      { from: 'you', text: 'O(n log n), for the sort.' },
      { from: 'them', text: 'Why the sort?' },
    ]);
    // And the route's GET, which is what the screen seeds from.
    expect(currentInterview(deps())?.transcript).toHaveLength(4);
  });

  it('caches what the interviewer already heard, not the new line (P5-13)', async () => {
    const { id } = sitting();
    await drain(sayToInterviewer(id, 'I would sort it first.', deps()));
    await drain(sayToInterviewer(id, 'O(n log n).', deps()));

    const body = JSON.parse(requests[1]!) as { messages: { content: unknown }[] };
    expect(body.messages.at(-2)?.content).toEqual([
      expect.objectContaining({ cache_control: { type: 'ephemeral' } }),
    ]);
    expect(typeof body.messages.at(-1)?.content).toBe('string');
  });

  it('keeps its conversation out of AI Help', async () => {
    const { id } = sitting();
    await drain(sayToInterviewer(id, 'I would sort it first.', deps()));

    const session = repos.coach.getSession(getInterview(id, deps()).sessionId!);
    expect(session?.kind).toBe('interview');
    // The AI Help button on the same problem finds no conversation to continue.
    expect(repos.coach.latestSession(SLUG, 'python')).toBeNull();
  });

  it('leaves blank turns and the debrief exchange out of the transcript', async () => {
    const { id } = sitting();
    await drain(sayToInterviewer(id, 'I would sort it first.', deps(replying('Go on.'))));
    const sessionId = getInterview(id, deps()).sessionId!;
    repos.coach.addMessage(sessionId, { role: 'user', content: '  ' });

    await drain(finishInterview(id, deps(replying('You explained the approach before coding.'))));

    const view = getInterview(id, deps());
    expect(view.debrief).toBe('You explained the approach before coding.');
    // The debrief is its own section on the screen; a copy in the transcript
    // would be the same essay twice.
    expect(view.transcript).toEqual([
      { from: 'you', text: 'I would sort it first.' },
      { from: 'them', text: 'Go on.' },
    ]);
  });

  it('leaves out the ask of a debrief that never came', async () => {
    const { id } = sitting();
    await drain(sayToInterviewer(id, 'I would sort it first.', deps(replying('Go on.'))));
    const refused = (async () => new Response('{}', { status: 400 })) as FetchLike;
    await drain(finishInterview(id, deps(refused)));

    const view = getInterview(id, deps());
    expect(view.stage).toBe('done');
    expect(view.debrief).toBeNull();
    // "That is time. How did I do?" is the app's line, not the candidate's.
    expect(view.transcript.map((line) => line.text)).toEqual(['I would sort it first.', 'Go on.']);
  });

  it('links the session a debrief creates, when nothing was said before it', async () => {
    const { id } = sitting();
    await drain(finishInterview(id, deps(replying('You never said an approach.'))));

    const view = getInterview(id, deps());
    expect(view.sessionId).not.toBeNull();
    expect(repos.coach.getSession(view.sessionId!)?.kind).toBe('interview');
  });
});
