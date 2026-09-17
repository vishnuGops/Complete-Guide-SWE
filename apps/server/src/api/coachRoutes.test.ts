import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  COACH_API_KEY_ENV,
  coachStreamEventSchema,
  type CoachStreamEvent,
} from '@devpromax/shared';
import type { FetchLike } from '../coach/index.js';
import { serverConfig } from '../config.js';
import { createDatabase, IN_MEMORY, type Repositories } from '../db/index.js';
import { buildServer } from '../index.js';
import { silentLogger } from '../logger.js';
import { makeCatalogue, writeProblem } from '../problems/__fixtures__/factory.js';

/**
 * The coach routes over the wire (ROADMAP P5-3, P3-5's pattern).
 *
 * `coachService.test.ts` covers what the service decides; this covers what
 * reaches the socket. The two things only testable here are the SSE framing -
 * markdown full of newlines has to survive a format whose delimiter *is* a
 * newline - and the split between failures that can still be a status code and
 * failures that cannot because the response has already begun.
 */

const SLUG = 'pair-sum-index';
const STARTER =
  'from typing import List\n\n\nclass Solution:\n    def pairSumIndex(self, nums: List[int], target: int) -> List[int]:\n        pass\n';
const ATTEMPT = STARTER.replace('        pass', '        return [0, 1]');

/** Deliberately full of the characters SSE and JSON each care about. */
const MARKDOWN =
  'Line one.\n\n- bullet with "quotes"\n- and a \\backslash\n\n```python\nx = 1\n```';

const ANSWER = {
  summary: 'Constant answer.',
  scores: {
    correctness: 1,
    timeComplexity: 3,
    spaceComplexity: 3,
    edgeCases: 1,
    readability: 3,
  },
  feedbackMarkdown: MARKDOWN,
  nextHintLevel: 'nudge' as const,
  mastered: false,
};

let app: FastifyInstance;
let repos: Repositories;
let root: string;

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
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ].join('');
}

const streamingFetch: FetchLike = (async () =>
  new Response(anthropicStream(JSON.stringify(ANSWER)), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })) as FetchLike;

function api(url: string, payload: object) {
  return app.inject({
    method: 'POST',
    url,
    payload,
    headers: {
      host: '127.0.0.1:5174',
      [serverConfig.clientHeader]: 'devpromax-web',
    },
  });
}

/** Parses an SSE body back into events, checked against the shared schema. */
function parseEvents(body: string): CoachStreamEvent[] {
  return body
    .split(/\r?\n\r?\n/)
    .filter((frame) => frame.trim() !== '')
    .map((frame) => {
      const data = frame.replace(/^data: /, '');
      // Parsed through the shared schema, so the route cannot drift into
      // sending a shape the client's own parser would reject.
      return coachStreamEventSchema.parse(JSON.parse(data));
    });
}

beforeEach(async () => {
  root = makeCatalogue();
  writeProblem(root, { topic: 'arrays', slug: SLUG });
  repos = createDatabase({ file: IN_MEMORY });

  app = await buildServer({
    logger: silentLogger,
    repositories: repos,
    problemsRoot: root,
    env: { [COACH_API_KEY_ENV]: 'test-key' },
    provider: { fetch: streamingFetch },
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  repos.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const body = (overrides: Record<string, unknown> = {}) => ({
  slug: SLUG,
  language: 'python',
  code: ATTEMPT,
  ...overrides,
});

describe('POST /api/coach/feedback', () => {
  it('answers as an event stream that proxies will not buffer', async () => {
    const response = await api('/api/coach/feedback', body());

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.headers['cache-control']).toContain('no-transform');
    expect(response.headers['x-accel-buffering']).toBe('no');
  });

  it('survives markdown full of newlines, quotes and backslashes', async () => {
    // SSE ends an event at a blank line, and this markdown contains blank
    // lines. If the payload were the text rather than JSON, one answer would
    // arrive as several broken events.
    const events = parseEvents((await api('/api/coach/feedback', body())).body);

    const rebuilt = events
      .filter((e) => e.type === 'markdown')
      .map((e) => e.delta)
      .join('');
    expect(rebuilt).toBe(MARKDOWN);

    const done = events.at(-1);
    expect(done?.type).toBe('done');
    expect(done?.type === 'done' && done.feedback.feedbackMarkdown).toBe(MARKDOWN);
  });

  it('opens with the session id, so a follow-up has somewhere to go', async () => {
    const events = parseEvents((await api('/api/coach/feedback', body())).body);
    const first = events[0];

    expect(first?.type).toBe('start');
    if (first?.type !== 'start') throw new Error('expected a start event');

    const chat = await api('/api/coach/chat', {
      sessionId: first.sessionId,
      message: 'Why?',
    });
    expect(chat.statusCode).toBe(200);
  });

  it('sends a local refusal as one skipped event, still 200', async () => {
    // Nothing went wrong: the request was simply not worth making. A 4xx would
    // read as "you did something invalid", which is not what happened.
    const response = await api('/api/coach/feedback', body({ code: STARTER }));

    expect(response.statusCode).toBe(200);
    expect(parseEvents(response.body)).toEqual([
      {
        type: 'skipped',
        reason: 'unchanged_starter',
        message: 'Write some code first, then ask for help.',
      },
    ]);
  });

  it('rejects an invalid body with a status code, before any stream opens', async () => {
    const response = await api('/api/coach/feedback', { slug: SLUG, language: 'cobol', code: 'x' });

    expect(response.statusCode).toBe(400);
    expect(response.headers['content-type']).toContain('application/json');
  });

  it('rejects an unknown slug with a 404, before any stream opens', async () => {
    const response = await api('/api/coach/feedback', body({ slug: 'no-such-problem' }));

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'NotFound' });
  });

  it('is refused without the client header, like every other route', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/coach/feedback',
      payload: body(),
      headers: { host: '127.0.0.1:5174' },
    });

    expect(response.statusCode).toBe(403);
  });
});

describe('POST /api/coach/chat', () => {
  it('rejects an unknown session with a 404', async () => {
    const response = await api('/api/coach/chat', {
      sessionId: '00000000-0000-4000-8000-000000000000',
      message: 'hi',
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects an empty message', async () => {
    const response = await api('/api/coach/chat', {
      sessionId: '00000000-0000-4000-8000-000000000000',
      message: '',
    });

    expect(response.statusCode).toBe(400);
  });
});
