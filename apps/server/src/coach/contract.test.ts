import { describe, expect, it } from 'vitest';
import type { CoachProvider as CoachProviderId, TokenUsage } from '@devpromax/shared';
import { createAnthropicProvider } from './anthropic.js';
import { createGeminiProvider } from './gemini.js';
import { coachFeedbackJsonSchema } from './feedback.js';
import {
  CoachProviderError,
  type CoachProvider,
  type FetchLike,
  type ProviderOptions,
  type StreamOptions,
} from './provider.js';

/**
 * The provider contract, run against both implementations (ROADMAP P5-7, D12).
 *
 * `stream.test.ts` covers what is *different* about each vendor - Anthropic's
 * delta events, Gemini's candidate frames, its schema narrowing. This file
 * covers what must be the *same*, and runs one set of assertions twice.
 *
 * That distinction is the whole premise of D12: switching provider is a
 * settings change, so anything above `coach/` is entitled to assume the two
 * behave identically. Two suites written separately drift - one grows a case
 * the other never gets - and the drift shows up as a bug that only appears for
 * whichever vendor the developer does not use.
 */

type Fixture = {
  /** A successful response whose text content is exactly `text`. */
  ok: (text: string) => Response;
  /** A response carrying an HTTP status and nothing useful. */
  status: (code: number) => Response;
  /** A successful response that also reports token usage. */
  withUsage: (text: string, usage: TokenUsage) => Response;
};

const anthropic: Fixture = {
  ok: (text) => anthropicSse(text, null),
  withUsage: (text, usage) => anthropicSse(text, usage),
  status: (code) => new Response('{}', { status: code }),
};

function anthropicSse(text: string, usage: TokenUsage | null): Response {
  const start = {
    type: 'message_start',
    message: {
      id: 'm',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: usage?.inputTokens ?? 0, output_tokens: 0 },
    },
  };

  const frames = [
    `event: message_start\ndata: ${JSON.stringify(start)}\n\n`,
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    `event: content_block_delta\ndata: ${JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    })}\n\n`,
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
    `event: message_delta\ndata: ${JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: usage?.outputTokens ?? 0 },
    })}\n\n`,
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ].join('');

  return new Response(frames, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const gemini: Fixture = {
  ok: (text) => geminiSse(text, null),
  withUsage: (text, usage) => geminiSse(text, usage),
  status: (code) => new Response('{}', { status: code }),
};

function geminiSse(text: string, usage: TokenUsage | null): Response {
  const chunk: Record<string, unknown> = {
    candidates: [{ content: { role: 'model', parts: [{ text }] } }],
  };
  if (usage) {
    chunk['usageMetadata'] = {
      promptTokenCount: usage.inputTokens,
      candidatesTokenCount: usage.outputTokens,
    };
  }

  return new Response(`data: ${JSON.stringify(chunk)}\n\n`, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

interface Vendor {
  id: CoachProviderId;
  label: RegExp;
  create: (options: ProviderOptions) => CoachProvider;
  fixture: Fixture;
  keyHeader: string;
}

const VENDORS: Vendor[] = [
  {
    id: 'anthropic',
    label: /Anthropic/,
    create: createAnthropicProvider,
    fixture: anthropic,
    keyHeader: 'x-api-key',
  },
  {
    id: 'gemini',
    label: /Google Gemini/,
    create: createGeminiProvider,
    fixture: gemini,
    keyHeader: 'x-goog-api-key',
  },
];

const API_KEY = 'secret-key-abc123';

interface Capture {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function stub(respond: () => Response | Promise<Response>): {
  fetch: FetchLike;
  calls: Capture[];
} {
  const calls: Capture[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = init?.headers;
    calls.push({
      url: String(input),
      headers: Object.fromEntries(
        (raw instanceof Headers
          ? [...raw.entries()]
          : Object.entries((raw ?? {}) as Record<string, string>)
        ).map(([k, v]) => [k.toLowerCase(), String(v)]),
      ),
      body: typeof init?.body === 'string' ? init.body : '',
    });
    return respond();
  }) as FetchLike;
  return { fetch, calls };
}

function options(overrides: Partial<StreamOptions> = {}): StreamOptions {
  return {
    apiKey: API_KEY,
    model: null,
    system: 'SYSTEM-PROMPT-TEXT',
    messages: [{ role: 'user', content: 'USER-TURN-TEXT' }],
    schema: coachFeedbackJsonSchema(),
    ...overrides,
  };
}

async function drain(provider: CoachProvider, opts: StreamOptions = options()): Promise<string> {
  let out = '';
  for await (const chunk of provider.stream(opts)) out += chunk;
  return out;
}

async function rejection(promise: Promise<unknown>): Promise<CoachProviderError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(CoachProviderError);
    return error as CoachProviderError;
  }
  throw new Error('expected the call to reject, but it resolved');
}

for (const vendor of VENDORS) {
  describe(`${vendor.id} satisfies the provider contract`, () => {
    const make = (respond: () => Response | Promise<Response>) => {
      const { fetch, calls } = stub(respond);
      return { provider: vendor.create({ fetch }), calls };
    };

    it('identifies itself and has a default model', () => {
      const { provider } = make(() => vendor.fixture.ok('x'));
      expect(provider.id).toBe(vendor.id);
      expect(provider.defaultModel.length).toBeGreaterThan(0);
    });

    it('yields exactly the text the vendor sent', async () => {
      const payload = '{"a":1,"b":"two"}';
      const { provider } = make(() => vendor.fixture.ok(payload));
      expect(await drain(provider)).toBe(payload);
    });

    it('sends the key in a header and never in the URL', async () => {
      const { provider, calls } = make(() => vendor.fixture.ok('x'));
      await drain(provider);

      expect(calls[0]?.headers[vendor.keyHeader]).toBe(API_KEY);
      expect(calls[0]?.url).not.toContain(API_KEY);
    });

    it('keeps the system prompt out of the conversation turns', async () => {
      // Both vendors have to carry the cacheable half separately, or the
      // caching D12 relies on cannot work for either of them.
      const { provider, calls } = make(() => vendor.fixture.ok('x'));
      await drain(provider);

      const body = JSON.parse(calls[0]!.body) as Record<string, unknown>;
      const asText = JSON.stringify(body);
      expect(asText).toContain('SYSTEM-PROMPT-TEXT');
      expect(asText).toContain('USER-TURN-TEXT');

      // The system prompt must not also appear inside the turns.
      const turns = JSON.stringify(body['messages'] ?? body['contents']);
      expect(turns).toContain('USER-TURN-TEXT');
      expect(turns).not.toContain('SYSTEM-PROMPT-TEXT');
    });

    it('reports the usage the vendor declared', async () => {
      const seen: TokenUsage[] = [];
      const { provider } = make(() =>
        vendor.fixture.withUsage('x', { inputTokens: 1234, outputTokens: 567 }),
      );

      await drain(provider, options({ onUsage: (usage) => seen.push(usage) }));

      expect(seen).toEqual([{ inputTokens: 1234, outputTokens: 567 }]);
    });

    it('reports no usage when the vendor declared none', async () => {
      // The spend cap reads "not reported" differently from "free" (P5-6), so
      // neither provider may invent a zero.
      const seen: TokenUsage[] = [];
      const { provider } = make(() => vendor.fixture.ok('x'));

      await drain(provider, options({ onUsage: (usage) => seen.push(usage) }));

      expect(seen).toEqual([]);
    });

    it('asks for prose when given no schema', async () => {
      const { provider, calls } = make(() => vendor.fixture.ok('x'));
      await drain(provider, options({ schema: undefined }));

      const body = calls[0]!.body;
      expect(body).not.toContain('json_schema');
      expect(body).not.toContain('responseSchema');
    });

    it.each([
      [401, false],
      [403, false],
      [404, false],
      [429, true],
      [500, true],
      [503, true],
    ])('maps HTTP %i to a %s error', async (status, retryable) => {
      const { provider } = make(() => vendor.fixture.status(status));
      const error = await rejection(drain(provider));

      expect(error.retryable).toBe(retryable);
      // Named, so the user knows which key to go and look at.
      expect(error.message).toMatch(vendor.label);
      // And never the raw status line, which tells them nothing to do.
      expect(error.message).not.toMatch(/^Request failed/);
    });

    it('turns an unreachable network into a retryable error without leaking it', async () => {
      const { provider } = make(() => {
        throw new TypeError('fetch failed: ECONNREFUSED 127.0.0.1:443');
      });
      const error = await rejection(drain(provider));

      expect(error.retryable).toBe(true);
      expect(error.message).toMatch(vendor.label);
      expect(error.message).not.toContain('ECONNREFUSED');
    });

    it('reports a cancelled turn as cancelled, not as a failure to report', async () => {
      const controller = new AbortController();
      const { provider } = make(() => {
        controller.abort();
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      });

      const error = await rejection(drain(provider, options({ signal: controller.signal })));
      expect(error.message).toMatch(/cancelled/i);
    });

    it('rejects a key check the vendor refuses, with advice rather than a status', async () => {
      const { provider } = make(() => vendor.fixture.status(401));
      const result = await provider.testConnection({ apiKey: 'wrong', model: null });

      expect(result.ok).toBe(false);
      expect(result.message).toMatch(vendor.label);
      expect(result.message).toMatch(/key/i);
    });
  });
}
