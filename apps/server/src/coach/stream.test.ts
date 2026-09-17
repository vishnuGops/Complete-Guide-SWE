import { describe, expect, it } from 'vitest';
import { MASTERY_THRESHOLD, type CoachFeedback } from '@devpromax/shared';
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
