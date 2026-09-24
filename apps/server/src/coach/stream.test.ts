import { describe, expect, it } from 'vitest';
import {
  ESTIMATED_THINKING_TOKENS,
  MASTERY_THRESHOLD,
  type CoachFeedback,
  type TokenUsage,
} from '@devpromax/shared';
import { createAnthropicProvider } from './anthropic.js';
import { createGeminiProvider } from './gemini.js';
import { coachFeedbackJsonSchema, parseFeedback, streamCoachFeedback } from './feedback.js';
import {
  CoachProviderError,
  type CoachProvider,
  type FetchLike,
  type StreamOptions,
} from './provider.js';

/**
 * The streaming adapters (ROADMAP P5-1, tested per D17 / P5-7).
 *
 * Recorded fixtures, never the network: CI has no keys and must not depend on
 * either vendor being up. What is under test is the part we wrote - the request
 * we build, the text we pull out of each vendor's frame shape, and the mapping
 * from a failure to something the user can act on.
 */

/** A complete, schema-valid answer, used as the body of the happy-path fixtures. */
const ANSWER: CoachFeedback = {
  summary: 'Correct, but quadratic.',
  scores: {
    correctness: 4,
    timeComplexity: 2,
    spaceComplexity: 4,
    edgeCases: 3,
    readability: 3,
  },
  feedbackMarkdown: 'Your nested loop is `O(n^2)`.\n\nA hash map gets you to `O(n)`.',
  nextHintLevel: 'concept',
  nextStep: 'Replace the inner loop with a dictionary lookup.',
  mastered: false,
};

const ANSWER_JSON = JSON.stringify(ANSWER);

/** Splits a document the way a network would: at arbitrary, unhelpful points. */
function inChunks(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

/** Distinctive on purpose: "the key is not in the URL" has to be able to fail. */
const API_KEY = 'secret-key-abc123';

const BASE: Omit<StreamOptions, 'schema'> = {
  apiKey: API_KEY,
  model: null,
  system: 'You are a coach.',
  messages: [{ role: 'user', content: 'Review my code' }],
};

function options(): StreamOptions {
  return { ...BASE, schema: coachFeedbackJsonSchema() };
}

async function drain(provider: CoachProvider): Promise<string> {
  let out = '';
  for await (const chunk of provider.stream(options())) out += chunk;
  return out;
}

/**
 * The error a promise rejected with, typed.
 *
 * Asserting the rejection here rather than casting at each call site means a
 * call that unexpectedly *succeeds* fails as a clear assertion, instead of
 * reading a property off the resolved value and failing further down with
 * something that does not say what went wrong.
 */
async function rejection(promise: Promise<unknown>): Promise<CoachProviderError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CoachProviderError);
    return error as CoachProviderError;
  }
  throw new Error('expected the call to reject, but it resolved');
}

// ---------------------------------------------------------------------------
// Fixtures: each vendor's streaming wire format, recorded by shape.
// ---------------------------------------------------------------------------

function anthropicSse(chunks: string[]): Response {
  const frames = [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}\n\n',
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    ...chunks.map(
      (text) =>
        `event: content_block_delta\ndata: ${JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text },
        })}\n\n`,
    ),
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":50}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ].join('');

  return new Response(frames, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function geminiSse(chunks: string[]): Response {
  const frames = chunks
    .map(
      (text) =>
        `data: ${JSON.stringify({
          candidates: [{ content: { role: 'model', parts: [{ text }] } }],
        })}\n\n`,
    )
    .join('');

  return new Response(frames, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

interface Capture {
  url: string;
  body: unknown;
  headers: Record<string, string>;
}

function stub(respond: () => Response): { fetch: FetchLike; calls: Capture[] } {
  const calls: Capture[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof init?.body === 'string' ? init.body : '';
    calls.push({
      url: String(input),
      body: raw === '' ? null : JSON.parse(raw),
      headers: Object.fromEntries(
        (init?.headers instanceof Headers
          ? [...init.headers.entries()]
          : Object.entries((init?.headers ?? {}) as Record<string, string>)
        ).map(([k, v]) => [k.toLowerCase(), String(v)]),
      ),
    });
    return respond();
  }) as FetchLike;
  return { fetch, calls };
}

// ---------------------------------------------------------------------------

describe('Anthropic streaming', () => {
  it('yields the text deltas and nothing else from the event stream', async () => {
    const { fetch } = stub(() => anthropicSse(inChunks(ANSWER_JSON, 40)));
    expect(await drain(createAnthropicProvider({ fetch }))).toBe(ANSWER_JSON);
  });

  it('caches the system prompt and keeps the volatile turns out of it', async () => {
    const { fetch, calls } = stub(() => anthropicSse([ANSWER_JSON]));
    await drain(createAnthropicProvider({ fetch }));

    const body = calls[0]?.body as {
      system: { text: string; cache_control?: { type: string } }[];
      messages: { role: string; content: string }[];
      output_config: { format: { type: string } };
      thinking: { type: string };
    };

    // The static half is cached; the code being reviewed is not part of it,
    // or the cache would miss on every request (D12).
    expect(body.system[0]?.cache_control).toEqual({ type: 'ephemeral' });
    expect(body.system[0]?.text).toBe('You are a coach.');
    expect(body.messages).toEqual([{ role: 'user', content: 'Review my code' }]);
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.thinking.type).toBe('adaptive');
  });

  it('sends the coach turns back as assistant turns', async () => {
    const { fetch, calls } = stub(() => anthropicSse([ANSWER_JSON]));
    const provider = createAnthropicProvider({ fetch });

    for await (const _ of provider.stream({
      ...options(),
      messages: [
        { role: 'user', content: 'first' },
        { role: 'coach', content: 'my earlier feedback' },
        { role: 'user', content: 'second' },
      ],
    }));

    expect((calls[0]?.body as { messages: unknown[] }).messages).toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'my earlier feedback' },
      { role: 'user', content: 'second' },
    ]);
  });

  it('turns a refused key into advice, not a status code', async () => {
    const { fetch } = stub(
      () =>
        new Response(JSON.stringify({ error: { message: 'invalid x-api-key' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const error = await rejection(drain(createAnthropicProvider({ fetch })));

    expect(error.message).toMatch(/rejected that API key/i);
    expect(error.retryable).toBe(false);
    // The vendor's own wording is for API integrators, not for our user.
    expect(error.message).not.toMatch(/x-api-key/);
  });

  it('marks a rate limit retryable and a bad request not', async () => {
    const limited = await rejection(
      drain(
        createAnthropicProvider({ fetch: stub(() => new Response('{}', { status: 429 })).fetch }),
      ),
    );
    expect(limited.retryable).toBe(true);

    const bad = await rejection(
      drain(
        createAnthropicProvider({ fetch: stub(() => new Response('{}', { status: 400 })).fetch }),
      ),
    );
    expect(bad.retryable).toBe(false);
  });
});

describe('Gemini streaming', () => {
  it('yields the text parts out of the candidate frames', async () => {
    const { fetch } = stub(() => geminiSse(inChunks(ANSWER_JSON, 40)));
    expect(await drain(createGeminiProvider({ fetch }))).toBe(ANSWER_JSON);
  });

  it('asks for JSON against the shared schema, and keeps the key out of the URL', async () => {
    const { fetch, calls } = stub(() => geminiSse([ANSWER_JSON]));
    await drain(createGeminiProvider({ fetch }));

    const call = calls[0]!;
    const body = call.body as {
      systemInstruction: { parts: { text: string }[] };
      contents: { role: string; parts: { text: string }[] }[];
      generationConfig: { responseMimeType: string; responseSchema: Record<string, unknown> };
    };

    expect(call.url).toContain(':streamGenerateContent');
    expect(call.url).toContain('alt=sse');
    // The key belongs in a header: a URL carrying a secret ends up in logs.
    expect(call.url).not.toContain(API_KEY);
    expect(call.headers['x-goog-api-key']).toBe(API_KEY);
    expect(body.systemInstruction.parts[0]?.text).toBe('You are a coach.');
    expect(body.contents[0]?.role).toBe('user');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.type).toBe('object');
  });

  it('strips JSON Schema keywords Gemini rejects', async () => {
    const { fetch, calls } = stub(() => geminiSse([ANSWER_JSON]));
    await drain(createGeminiProvider({ fetch }));

    const schema = (
      calls[0]?.body as { generationConfig: { responseSchema: Record<string, unknown> } }
    ).generationConfig.responseSchema;

    expect(JSON.stringify(schema)).not.toMatch(/\$schema|additionalProperties|\$ref|default/);
    // Narrowing must not cost the fields themselves.
    expect(Object.keys(schema.properties as object)).toContain('feedbackMarkdown');
  });

  it('names Gemini, not Anthropic, when the key is refused', async () => {
    const { fetch } = stub(() => new Response('{}', { status: 403 }));
    const error = await rejection(drain(createGeminiProvider({ fetch })));

    expect(error.message).toContain('Google Gemini');
    expect(error.retryable).toBe(false);
  });

  it('ignores frames that carry no text', async () => {
    const { fetch } = stub(
      () =>
        new Response(
          `data: {"candidates":[{"finishReason":"STOP"}]}\n\ndata: ${JSON.stringify({
            candidates: [{ content: { parts: [{ text: ANSWER_JSON }] } }],
          })}\n\ndata: {"usageMetadata":{"totalTokenCount":9}}\n\n`,
          { status: 200 },
        ),
    );

    expect(await drain(createGeminiProvider({ fetch }))).toBe(ANSWER_JSON);
  });
});

// ---------------------------------------------------------------------------

describe('streamCoachFeedback', () => {
  /** A provider that replays a fixed set of chunks; no vendor involved. */
  function fakeProvider(chunks: string[]): CoachProvider {
    return {
      id: 'anthropic',
      defaultModel: 'test',
      testConnection: () => Promise.resolve({ ok: true, message: '', model: null }),
      async *stream() {
        for (const chunk of chunks) yield chunk;
      },
    };
  }

  const run = async (chunks: string[]) => {
    const events = [];
    for await (const event of streamCoachFeedback(fakeProvider(chunks), BASE)) events.push(event);
    return events;
  };

  it('streams the markdown as it arrives and validates the whole at the end', async () => {
    const events = await run(inChunks(ANSWER_JSON, 25));

    const markdown = events
      .filter((e) => e.type === 'markdown')
      .map((e) => e.delta)
      .join('');
    expect(markdown).toBe(ANSWER.feedbackMarkdown);

    const last = events.at(-1);
    expect(last?.type).toBe('done');
    expect(last?.type === 'done' && last.feedback).toEqual(ANSWER);
  });

  it('emits markdown before the stream has finished, not only at the end', async () => {
    const events = await run(inChunks(ANSWER_JSON, 25));
    // The point of the whole partial-JSON exercise: the panel paints early.
    expect(events.findIndex((e) => e.type === 'markdown')).toBeLessThan(events.length - 1);
  });

  it('calls a truncated answer cut off, and says it is worth retrying', async () => {
    const error = await rejection(run(inChunks(ANSWER_JSON.slice(0, 80), 25)));

    expect(error.message).toMatch(/cut off/i);
    expect(error.retryable).toBe(true);
  });

  it('calls a well-formed answer of the wrong shape unexpected, and does not retry it', async () => {
    const error = await rejection(run(['{"summary":"hi","mastered":false}']));

    expect(error.message).toMatch(/unexpected shape/i);
    expect(error.retryable).toBe(false);
  });

  it('rejects an empty response rather than reporting empty feedback', async () => {
    const error = await rejection(run([]));
    expect(error.message).toMatch(/empty/i);
  });
});

describe('parseFeedback', () => {
  it('accepts a mastered answer at the threshold', () => {
    const perfect = {
      ...ANSWER,
      scores: {
        correctness: MASTERY_THRESHOLD,
        timeComplexity: MASTERY_THRESHOLD,
        spaceComplexity: MASTERY_THRESHOLD,
        edgeCases: MASTERY_THRESHOLD,
        readability: MASTERY_THRESHOLD,
      },
      mastered: true,
    };

    expect(parseFeedback(JSON.stringify(perfect)).mastered).toBe(true);
  });

  it('rejects a score outside the rubric range', () => {
    const wrong = { ...ANSWER, scores: { ...ANSWER.scores, correctness: 9 } };
    expect(() => parseFeedback(JSON.stringify(wrong))).toThrow(/unexpected shape/i);
  });

  it('tolerates whitespace and a missing optional next step', () => {
    const { nextStep: _nextStep, ...withoutNextStep } = ANSWER;
    const parsed = parseFeedback(`\n  ${JSON.stringify(withoutNextStep)}  \n`);
    expect(parsed.nextStep).toBeUndefined();
    expect(parsed.summary).toBe(ANSWER.summary);
  });
});

// ---------------------------------------------------------------------------
// What a turn costs, and what stops one (ROADMAP P5-9)
// ---------------------------------------------------------------------------

describe('usage reporting', () => {
  /** One Anthropic stream with whatever usage the test needs on `message_start`. */
  function withUsage(usage: Record<string, number>, stopReason = 'end_turn'): Response {
    const frames = [
      `event: message_start\ndata: ${JSON.stringify({
        type: 'message_start',
        message: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5',
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { output_tokens: 0, ...usage },
        },
      })}\n\n`,
      'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      `event: content_block_delta\ndata: ${JSON.stringify({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: ANSWER_JSON },
      })}\n\n`,
      'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
      `event: message_delta\ndata: ${JSON.stringify({
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: 40 },
      })}\n\n`,
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ].join('');

    return new Response(frames, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }

  it('reports the cache tokens, which is where the system prompt is billed', async () => {
    const { fetch } = stub(() =>
      withUsage({
        input_tokens: 500,
        cache_creation_input_tokens: 4000,
        cache_read_input_tokens: 1000,
      }),
    );

    const seen: TokenUsage[] = [];
    for await (const _ of createAnthropicProvider({ fetch }).stream({
      ...options(),
      onUsage: (usage) => seen.push(usage),
    }));

    // Before P5-9 only `input_tokens` was reported, so the turn that writes the
    // whole cached system prompt - the first of every session - was recorded as
    // the cheapest one.
    expect(seen).toEqual([
      { inputTokens: 500, outputTokens: 40, cacheWriteTokens: 4000, cacheReadTokens: 1000 },
    ]);
  });

  it('reports usage even when the stream is abandoned halfway', async () => {
    const { fetch } = stub(() => withUsage({ input_tokens: 700 }));

    const seen: TokenUsage[] = [];
    const stream = createAnthropicProvider({ fetch }).stream({
      ...options(),
      onUsage: (usage) => seen.push(usage),
    });

    // One chunk, then walk away - the shape of Stop, and of a timeout.
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.(undefined);

    // The tokens were spent whether or not anyone read the answer; reporting
    // only on success recorded a failed turn as free (P5-9).
    expect(seen).toHaveLength(1);
    expect(seen[0]?.inputTokens).toBe(700);
    // And the output is an estimate, not the one-token placeholder from
    // `message_start`: the turn was most likely stopped mid-think (P5-13).
    expect(seen[0]?.outputTokens).toBeGreaterThanOrEqual(ESTIMATED_THINKING_TOKENS);
  });

  it('refuses to call a truncated answer retryable', async () => {
    const { fetch } = stub(() => withUsage({ input_tokens: 10 }, 'max_tokens'));
    const error = await rejection(drain(createAnthropicProvider({ fetch })));

    // The old behaviour: "cut off, try again", and the retry truncated at the
    // same place for the same money.
    expect(error.message).toMatch(/ceiling/i);
    expect(error.retryable).toBe(false);
  });

  it('asks for a medium effort and room for the thinking', async () => {
    const { fetch, calls } = stub(() => anthropicSse([ANSWER_JSON]));
    await drain(createAnthropicProvider({ fetch }));

    const body = calls[0]?.body as {
      max_tokens: number;
      output_config: { effort: string };
    };

    // `max_tokens` covers thinking as well as the answer, so a budget tight
    // enough to hold only the JSON truncated it whenever the model thought
    // hard (P5-9).
    expect(body.max_tokens).toBeGreaterThanOrEqual(16_000);
    expect(body.output_config.effort).toBe('medium');
  });
});

describe('Gemini history', () => {
  it('merges consecutive same-role turns, which Gemini would reject', async () => {
    const { fetch, calls } = stub(() => geminiSse([ANSWER_JSON]));

    for await (const _ of createGeminiProvider({ fetch }).stream({
      ...options(),
      messages: [
        { role: 'user', content: 'first question' },
        // What a failed turn leaves behind: a question with no answer, then
        // the next question. Gemini answers 400 to that for the rest of the
        // conversation (P5-9).
        { role: 'user', content: 'second question' },
        { role: 'coach', content: 'an answer' },
      ],
    }));

    const body = calls[0]?.body as { contents: { role: string; parts: { text: string }[] }[] };

    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'first question' }, { text: 'second question' }] },
      { role: 'model', parts: [{ text: 'an answer' }] },
    ]);
  });
});

// ---------------------------------------------------------------------------
// The request meets the real API (ROADMAP P5-11)
// ---------------------------------------------------------------------------

/** Every object node of a JSON document, with where it is. */
function objectsIn(node: unknown, path = '$'): { path: string; value: Record<string, unknown> }[] {
  if (Array.isArray(node)) return node.flatMap((item, i) => objectsIn(item, `${path}[${i}]`));
  if (typeof node !== 'object' || node === null) return [];
  const value = node as Record<string, unknown>;
  return [
    { path, value },
    ...Object.entries(value).flatMap(([key, child]) => objectsIn(child, `${path}.${key}`)),
  ];
}

/** An Anthropic stream built from raw frames, for the shapes the happy path never shows. */
function frames(...parts: string[]): Response {
  return new Response(parts.join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

const MESSAGE_START =
  'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-opus-5","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}\n\n';
const TEXT_START =
  'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n';
const textDelta = (text: string) =>
  `event: content_block_delta\ndata: ${JSON.stringify({
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text },
  })}\n\n`;

/** Runs a stream to the end, for the cases where only the failure matters. */
async function run(provider: CoachProvider, overrides: Partial<StreamOptions> = {}) {
  for await (const _ of provider.stream({ ...options(), ...overrides }));
}

describe('the structured-output schema Anthropic is sent', () => {
  async function sentSchema(): Promise<unknown> {
    const { fetch, calls } = stub(() => anthropicSse([ANSWER_JSON]));
    await drain(createAnthropicProvider({ fetch }));
    return (calls[0]?.body as { output_config: { format: { schema: unknown } } }).output_config
      .format.schema;
  }

  it('closes every object, as structured outputs require', async () => {
    // Without `additionalProperties: false` on every object the vendor answers
    // 400 - on every AI Help click, since every one sends this schema.
    const objects = objectsIn(await sentSchema()).filter(({ value }) => value['type'] === 'object');

    expect(objects.length).toBeGreaterThanOrEqual(2); // the answer and its scores
    for (const { path, value } of objects) {
      expect(value['additionalProperties'], path).toBe(false);
    }
  });

  it('carries none of the keywords the vendor refuses', async () => {
    const refused = ['$schema', 'minimum', 'maximum', 'minLength', 'maxLength', 'default'];
    for (const { path, value } of objectsIn(await sentSchema())) {
      // `properties` maps field names, not keywords; none of ours collide.
      for (const keyword of refused) expect(Object.keys(value), path).not.toContain(keyword);
    }
  });

  it('keeps every field, and the dropped limits where the model can still read them', async () => {
    const schema = (await sentSchema()) as {
      properties: Record<string, { description?: string }>;
      required: string[];
    };

    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining([
        'summary',
        'scores',
        'feedbackMarkdown',
        'nextHintLevel',
        'mastered',
      ]),
    );
    expect(schema.required).toEqual(expect.arrayContaining(['summary', 'scores', 'mastered']));
    // The SDK's transform moves a constraint it drops into the description.
    expect(schema.properties['summary']?.description).toMatch(/maxLength: 280/);
  });
});

describe('what each model is asked for (P5-11)', () => {
  async function bodyFor(model: string, schema = true) {
    const { fetch, calls } = stub(() => anthropicSse([ANSWER_JSON]));
    const provider = createAnthropicProvider({ fetch });
    for await (const _ of provider.stream({ ...(schema ? options() : BASE), model }));
    return calls[0]?.body as {
      max_tokens: number;
      thinking?: { type: string };
      output_config?: { effort?: string; format?: unknown };
    };
  }

  it('asks a thinking model to think adaptively, at an effort', async () => {
    const body = await bodyFor('claude-opus-5');
    expect(body.thinking).toEqual({ type: 'adaptive' });
    expect(body.output_config?.effort).toBe('medium');
  });

  it('asks Haiku 4.5 for neither, which it would refuse with a 400', async () => {
    const body = await bodyFor('claude-haiku-4-5');

    expect(body.thinking).toBeUndefined();
    expect(body.output_config?.effort).toBeUndefined();
    // Still structured: the schema is not a thinking feature.
    expect(body.output_config?.format).toBeDefined();
    expect(body.max_tokens).toBeLessThanOrEqual(8_192);
  });

  it('sends no output_config at all to an old model on a prose turn', async () => {
    expect(await bodyFor('claude-haiku-4-5', false)).not.toHaveProperty('output_config');
  });

  it('asks a prose turn for low effort, and a review for medium (P5-13)', async () => {
    expect((await bodyFor('claude-opus-5', false)).output_config?.effort).toBe('low');
    expect((await bodyFor('claude-opus-5', true)).output_config?.effort).toBe('medium');
  });
});

describe('what a failed request tells the user (P5-11)', () => {
  it('says there is no such model on a 404, rather than blaming the key', async () => {
    const { fetch } = stub(
      () =>
        new Response(
          JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'model' } }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        ),
    );

    const error = await rejection(
      run(createAnthropicProvider({ fetch }), { model: 'claude-opus-9-typo' }),
    );

    expect(error.message).toContain('no model called "claude-opus-9-typo"');
    expect(error.message).not.toMatch(/different product/);
    expect(error.retryable).toBe(false);
  });

  it('surfaces the explanation the vendor gave for a 400, trimmed and without the key', async () => {
    const vendorSays = `messages.0.content: text content blocks must be non-empty (key ${API_KEY}) ${'x'.repeat(600)}`;
    const { fetch } = stub(
      () =>
        new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'invalid_request_error', message: vendorSays },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );

    const error = await rejection(drain(createAnthropicProvider({ fetch })));

    // What the old generic "refused the request (HTTP 400)" left out.
    expect(error.message).toContain('text content blocks must be non-empty');
    expect(error.message).not.toContain(API_KEY);
    expect(error.message.length).toBeLessThan(400);
    expect(error.retryable).toBe(false);
  });

  it('calls a mid-stream overload retryable, not "failed unexpectedly"', async () => {
    const { fetch } = stub(() =>
      frames(
        MESSAGE_START,
        TEXT_START,
        textDelta('{"summary":"'),
        'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n',
      ),
    );

    const error = await rejection(drain(createAnthropicProvider({ fetch })));

    expect(error.message).toMatch(/overloaded/i);
    expect(error.retryable).toBe(true);
  });

  it('calls a mid-stream api_error retryable, and theirs', async () => {
    const { fetch } = stub(() =>
      frames(
        MESSAGE_START,
        'event: error\ndata: {"type":"error","error":{"type":"api_error","message":"Internal"}}\n\n',
      ),
    );

    const error = await rejection(drain(createAnthropicProvider({ fetch })));
    expect(error.message).toMatch(/their side/i);
    expect(error.retryable).toBe(true);
  });

  it('reports a refusal as final, and says the key is fine', async () => {
    const { fetch } = stub(() =>
      frames(
        MESSAGE_START,
        TEXT_START,
        textDelta('{"summary":"'),
        `event: message_delta\ndata: ${JSON.stringify({
          type: 'message_delta',
          delta: {
            stop_reason: 'refusal',
            stop_sequence: null,
            stop_details: { type: 'refusal', category: 'cyber', explanation: null },
          },
          usage: { output_tokens: 5 },
        })}\n\n`,
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ),
    );

    const error = await rejection(drain(createAnthropicProvider({ fetch })));

    expect(error.message).toMatch(/safety/i);
    expect(error.message).toMatch(/nothing is wrong with your key/i);
    // The same code meets the same filter; "try again" would pay to learn that.
    expect(error.retryable).toBe(false);
  });

  it('retries a failed stream once, not twice', async () => {
    const { fetch, calls } = stub(
      () => new Response('{}', { status: 529, headers: { 'retry-after-ms': '1' } }),
    );

    await rejection(drain(createAnthropicProvider({ fetch })));

    // Each retry of a streamed turn is a new turn, billed from the start.
    expect(calls).toHaveLength(2);
  });
});

describe('the idle watchdog (P5-11)', () => {
  /** A stream that opens, says one thing, and then goes silent without closing. */
  function silentAfterStart(): FetchLike {
    return (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(MESSAGE_START + TEXT_START + textDelta('{"sum')));
          init?.signal?.addEventListener('abort', () => {
            controller.error(new DOMException('aborted', 'AbortError'));
          });
        },
      });
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    }) as FetchLike;
  }

  it('abandons a stream that has gone quiet, and offers a retry', async () => {
    const seen: TokenUsage[] = [];
    const provider = createAnthropicProvider({ fetch: silentAfterStart(), streamIdleMs: 50 });

    const error = await rejection(run(provider, { onUsage: (usage) => seen.push(usage) }));

    // Before the watchdog nothing ended this turn: the SDK's timeout only
    // covers the wait for headers, which had long since arrived.
    expect(error.message).toMatch(/stopped sending/i);
    expect(error.retryable).toBe(true);
    // And what it spent before going quiet is still reported.
    expect(seen[0]?.inputTokens).toBe(10);
  });

  it('does not fire on a stream that keeps talking', async () => {
    const { fetch } = stub(() => anthropicSse(inChunks(ANSWER_JSON, 40)));
    expect(await drain(createAnthropicProvider({ fetch, streamIdleMs: 50 }))).toBe(ANSWER_JSON);
  });
});

describe('caching a conversation (P5-13)', () => {
  it('puts a breakpoint on the turn the caller marks, and nowhere else', async () => {
    const { fetch, calls } = stub(() => anthropicSse(['Because.']));

    await run(createAnthropicProvider({ fetch }), {
      schema: undefined,
      messages: [
        { role: 'user', content: 'the review context' },
        { role: 'coach', content: 'the review', cacheBreakpoint: true },
        { role: 'user', content: 'why?' },
      ],
    });

    const body = calls[0]?.body as { messages: { role: string; content: unknown }[] };
    expect(body.messages[0]?.content).toBe('the review context');
    expect(body.messages[1]?.content).toEqual([
      { type: 'text', text: 'the review', cache_control: { type: 'ephemeral' } },
    ]);
    // The new question is the one part that differs next time.
    expect(body.messages[2]?.content).toBe('why?');
  });

  it('sends the instructions for a turn as a second, uncached system block (P5-12)', async () => {
    const { fetch, calls } = stub(() => anthropicSse(['Because.']));

    await run(createAnthropicProvider({ fetch }), {
      schema: undefined,
      instructions: 'Answer in prose.',
    });

    const body = calls[0]?.body as { system: unknown[] };
    // The cached prefix is byte-identical to a review's.
    expect(body.system).toEqual([
      { type: 'text', text: 'You are a coach.', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'Answer in prose.' },
    ]);
  });
});

describe('Gemini thinking and instructions', () => {
  it('counts the thinking tokens as output, which is how they are billed (P5-13)', async () => {
    const { fetch } = stub(
      () =>
        new Response(
          `data: ${JSON.stringify({
            candidates: [{ content: { parts: [{ text: ANSWER_JSON }] } }],
            usageMetadata: {
              promptTokenCount: 100,
              candidatesTokenCount: 50,
              thoughtsTokenCount: 700,
            },
          })}\n\n`,
          { status: 200 },
        ),
    );

    const seen: TokenUsage[] = [];
    await run(createGeminiProvider({ fetch }), { onUsage: (usage) => seen.push(usage) });

    expect(seen).toEqual([{ inputTokens: 100, outputTokens: 750 }]);
  });

  it('sends instructions as a second system part (P5-12)', async () => {
    const { fetch, calls } = stub(() => geminiSse(['Because.']));
    await run(createGeminiProvider({ fetch }), {
      schema: undefined,
      instructions: 'Answer in prose.',
    });

    const body = calls[0]?.body as { systemInstruction: { parts: { text: string }[] } };
    expect(body.systemInstruction.parts).toEqual([
      { text: 'You are a coach.' },
      { text: 'Answer in prose.' },
    ]);
  });
});
