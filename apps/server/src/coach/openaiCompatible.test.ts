import { describe, expect, it, vi } from 'vitest';
import { createOpenAiCompatibleProvider } from './openaiCompatible.js';
import { coachFeedbackJsonSchema } from './feedback.js';
import { CoachProviderError, type FetchLike } from './provider.js';

/**
 * What is particular to an endpoint that is not a vendor (ROADMAP P9-4).
 *
 * `contract.test.ts` covers what this provider shares with the other two. This
 * file covers what it does not: a base URL that is configuration rather than a
 * constant, a key that is often absent because the server is on this machine,
 * and structured output that has to be negotiated because half the servers this
 * exists for only do the looser mode.
 */

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function stub(...responses: (() => Response)[]): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  let at = 0;
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    calls.push({
      url: String(input),
      headers,
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
    });
    const make = responses[Math.min(at, responses.length - 1)];
    at += 1;
    return Promise.resolve(make!());
  });
  return { fetch: fetch as unknown as FetchLike, calls };
}

function sse(text: string): Response {
  return new Response(
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`,
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
}

async function drain(
  provider: ReturnType<typeof createOpenAiCompatibleProvider>,
  schema?: Record<string, unknown>,
): Promise<string> {
  let out = '';
  for await (const piece of provider.stream({
    apiKey: '',
    model: null,
    system: 'S',
    messages: [{ role: 'user', content: 'U' }],
    ...(schema ? { schema } : {}),
  })) {
    out += piece;
  }
  return out;
}

describe('the base URL', () => {
  it('defaults to Ollama, because that is what most people have running', async () => {
    const { fetch, calls } = stub(() => sse('x'));
    await drain(createOpenAiCompatibleProvider({ fetch }));

    expect(calls[0]?.url).toBe('http://127.0.0.1:11434/v1/chat/completions');
  });

  it('goes wherever it is pointed, trailing slash or not', async () => {
    for (const base of ['http://localhost:1234/v1', 'http://localhost:1234/v1/']) {
      const { fetch, calls } = stub(() => sse('x'));
      await drain(createOpenAiCompatibleProvider({ fetch, baseUrl: base }));
      expect(calls[0]?.url).toBe('http://localhost:1234/v1/chat/completions');
    }
  });

  it('says where it looked when it could not get there', async () => {
    const fetch = vi.fn(() => Promise.reject(new TypeError('fetch failed')));
    const provider = createOpenAiCompatibleProvider({
      fetch: fetch as unknown as FetchLike,
      baseUrl: 'http://localhost:9999/v1',
    });

    // "Could not reach it" is useless when the whole configuration is *which*
    // "it" - the first thing to check is whether the address is right.
    const result = await provider.testConnection({ apiKey: '', model: null });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('http://localhost:9999/v1');
  });
});

describe('the key', () => {
  it('is sent as a bearer token even when there is not one', async () => {
    // Several local servers reject a *missing* Authorization while ignoring
    // its contents, so an empty key still sends the header. It arrives as
    // `Bearer` rather than `Bearer `, because trailing whitespace in a header
    // value is not something HTTP keeps.
    const { fetch, calls } = stub(() => sse('x'));
    await drain(createOpenAiCompatibleProvider({ fetch }));

    expect(calls[0]?.headers['authorization']).toBe('Bearer');
  });

  it('carries a real key when there is one', async () => {
    const { fetch, calls } = stub(() => sse('x'));
    const provider = createOpenAiCompatibleProvider({ fetch });
    for await (const _ of provider.stream({
      apiKey: 'sk-local-123',
      model: 'm',
      system: 'S',
      messages: [{ role: 'user', content: 'U' }],
    })) {
      // drained
    }

    expect(calls[0]?.headers['authorization']).toBe('Bearer sk-local-123');
    expect(calls[0]?.url).not.toContain('sk-local-123');
  });
});

describe('structured output', () => {
  it('asks for a JSON schema when there is one', async () => {
    const { fetch, calls } = stub(() => sse('{}'));
    await drain(createOpenAiCompatibleProvider({ fetch }), coachFeedbackJsonSchema());

    const format = calls[0]?.body['response_format'] as { type?: string };
    expect(format?.type).toBe('json_schema');
  });

  it('retries in the looser mode when the server does not do schemas', async () => {
    /*
     * The compatibility affordance this provider exists for: llama.cpp and
     * several small servers answer a `json_schema` request with a 400, and a
     * single failed turn would make the coach unusable against them. The
     * answer is re-validated against the real zod schema afterwards either
     * way, so this costs strictness at the vendor rather than correctness here.
     */
    const { fetch, calls } = stub(
      () =>
        new Response('{"error":{"message":"response_format json_schema not supported"}}', {
          status: 400,
        }),
      () => sse('{"ok":true}'),
    );

    const text = await drain(createOpenAiCompatibleProvider({ fetch }), coachFeedbackJsonSchema());

    expect(text).toBe('{"ok":true}');
    expect(calls).toHaveLength(2);
    expect((calls[0]?.body['response_format'] as { type?: string })?.type).toBe('json_schema');
    expect((calls[1]?.body['response_format'] as { type?: string })?.type).toBe('json_object');
  });

  it('does not retry a 400 that is about something else', async () => {
    // A key problem is not a schema problem, and retrying it would spend a
    // second request to be told the same thing.
    const { fetch, calls } = stub(
      () => new Response('{"error":{"message":"invalid api key"}}', { status: 400 }),
    );

    await expect(
      drain(createOpenAiCompatibleProvider({ fetch }), coachFeedbackJsonSchema()),
    ).rejects.toBeInstanceOf(CoachProviderError);
    expect(calls).toHaveLength(1);
  });

  it('asks for nothing at all on a plain prose turn', async () => {
    const { fetch, calls } = stub(() => sse('hello'));
    await drain(createOpenAiCompatibleProvider({ fetch }));

    expect(calls[0]?.body['response_format']).toBeUndefined();
  });
});

describe('usage', () => {
  it('asks for it, since the stream reports none without being told', async () => {
    const { fetch, calls } = stub(() => sse('x'));
    await drain(createOpenAiCompatibleProvider({ fetch }));

    expect(calls[0]?.body['stream_options']).toEqual({ include_usage: true });
  });
});

describe('testConnection', () => {
  function models(ids: string[]): Response {
    return Response.json({ data: ids.map((id) => ({ id })) });
  }

  it('accepts a model the endpoint lists', async () => {
    const { fetch } = stub(() => models(['qwen2.5-coder:14b', 'llama3.1:8b']));
    const result = await createOpenAiCompatibleProvider({ fetch }).testConnection({
      apiKey: '',
      model: 'llama3.1:8b',
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain('llama3.1:8b');
  });

  it('names what is available when the model is not there', async () => {
    const { fetch } = stub(() => models(['llama3.1:8b']));
    const result = await createOpenAiCompatibleProvider({ fetch }).testConnection({
      apiKey: '',
      model: 'gpt-4',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('llama3.1:8b');
  });

  it('refuses a 200 that is not a model list', async () => {
    // A captive portal, a proxy, or a base URL pointing at something else
    // entirely - all of which used to read as a working connection (P5-10).
    const { fetch } = stub(() => new Response('<html>hello</html>', { status: 200 }));
    const result = await createOpenAiCompatibleProvider({ fetch }).testConnection({
      apiKey: '',
      model: null,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('not with a model list');
  });
});
