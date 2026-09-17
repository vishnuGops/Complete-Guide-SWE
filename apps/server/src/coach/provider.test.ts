import { describe, expect, it } from 'vitest';
import { ANTHROPIC_DEFAULT_MODEL, createAnthropicProvider } from './anthropic.js';
import { GEMINI_DEFAULT_MODEL, createGeminiProvider } from './gemini.js';
import { createCoachProvider, type FetchLike } from './index.js';

/**
 * Provider connection checks (ROADMAP P3-4).
 *
 * `fetch` is injected and no test touches the network: CI has no keys and must
 * not depend on either vendor being up (P5-7 keeps that rule for the streaming
 * adapters too). What is under test is the mapping from an HTTP outcome to
 * something a user can act on.
 */

interface Call {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Headers reach `fetch` in three shapes, and which one you get is the caller's
 * business rather than ours: the Anthropic SDK builds a `Headers`, our own
 * Gemini code passes an object literal. Normalising here keeps the assertions
 * about *what was sent* rather than about how the sender happened to spell it.
 * Names are lower-cased because HTTP header names are case-insensitive.
 */
function normaliseHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (headers === undefined) return {};
  const entries =
    headers instanceof Headers
      ? [...headers.entries()]
      : Array.isArray(headers)
        ? headers
        : Object.entries(headers);
  return Object.fromEntries(entries.map(([name, value]) => [name.toLowerCase(), String(value)]));
}

function stubFetch(respond: () => Response | Promise<Response>): {
  fetch: FetchLike;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: normaliseHeaders(init?.headers),
      body: typeof init?.body === 'string' ? init.body : '',
    });
    return respond();
  }) as FetchLike;
  return { fetch, calls };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const anthropicModels = (...ids: string[]) => jsonResponse({ data: ids.map((id) => ({ id })) });
const geminiModels = (...ids: string[]) =>
  jsonResponse({ models: ids.map((id) => ({ name: `models/${id}` })) });

describe('createCoachProvider', () => {
  it('maps each id to its implementation', () => {
    expect(createCoachProvider('anthropic').id).toBe('anthropic');
    expect(createCoachProvider('gemini').id).toBe('gemini');
  });
});

describe('Anthropic connection test', () => {
  it('accepts a key whose model list contains the configured model', async () => {
    const { fetch, calls } = stubFetch(() => anthropicModels('claude-opus-5', 'claude-sonnet-5'));
    const provider = createAnthropicProvider({ fetch });

    const result = await provider.testConnection({ apiKey: 'sk-ant-secret', model: null });

    expect(result.ok).toBe(true);
    expect(result.model).toBe(ANTHROPIC_DEFAULT_MODEL);
    expect(result.message).toContain(ANTHROPIC_DEFAULT_MODEL);
    expect(calls[0]?.headers['x-api-key']).toBe('sk-ant-secret');
    expect(calls[0]?.headers['anthropic-version']).toBe('2023-06-01');
    // The key belongs in a header: a URL carrying a secret ends up in logs.
    expect(calls[0]?.url).not.toContain('sk-ant-secret');
  });

  it('rejects a key the vendor refuses, and says what to do about it', async () => {
    const { fetch } = stubFetch(() => jsonResponse({ error: 'unauthorized' }, 401));
    const result = await createAnthropicProvider({ fetch }).testConnection({
      apiKey: 'sk-ant-wrong',
      model: null,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/rejected that API key/i);
  });

  it('separates "key is fine" from "that model does not exist"', async () => {
    const { fetch } = stubFetch(() => anthropicModels('claude-opus-5'));
    const result = await createAnthropicProvider({ fetch }).testConnection({
      apiKey: 'sk-ant-secret',
      model: 'claude-imaginary-9',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('claude-imaginary-9');
    expect(result.message).toContain('claude-opus-5');
  });

  it('passes when the model list is unreadable: the 200 already proved the key', async () => {
    const { fetch } = stubFetch(() => new Response('not json at all', { status: 200 }));
    const result = await createAnthropicProvider({ fetch }).testConnection({
      apiKey: 'sk-ant-secret',
      model: 'claude-opus-5',
    });

    expect(result.ok).toBe(true);
  });

  it('reports a rate limit and a server error as the vendor’s problem', async () => {
    const limited = await createAnthropicProvider({
      fetch: stubFetch(() => jsonResponse({}, 429)).fetch,
    }).testConnection({ apiKey: 'k', model: null });
    expect(limited.message).toMatch(/rate-limiting/i);

    const broken = await createAnthropicProvider({
      fetch: stubFetch(() => jsonResponse({}, 503)).fetch,
    }).testConnection({ apiKey: 'k', model: null });
    expect(broken.message).toMatch(/their side/i);
  });

  it('reports an unreachable network without leaking the exception', async () => {
    const { fetch } = stubFetch(() => {
      throw new TypeError('fetch failed');
    });
    const result = await createAnthropicProvider({ fetch }).testConnection({
      apiKey: 'k',
      model: null,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Could not reach Anthropic/);
    expect(result.message).not.toContain('fetch failed');
  });
});

describe('Gemini connection test', () => {
  it('accepts a key and compares against the prefix-stripped model names', async () => {
    const { fetch, calls } = stubFetch(() =>
      geminiModels(GEMINI_DEFAULT_MODEL, 'gemini-2.5-flash'),
    );
    const result = await createGeminiProvider({ fetch }).testConnection({
      apiKey: 'goog-secret',
      model: null,
    });

    expect(result.ok).toBe(true);
    expect(result.model).toBe(GEMINI_DEFAULT_MODEL);
    expect(calls[0]?.headers['x-goog-api-key']).toBe('goog-secret');
    expect(calls[0]?.url).not.toContain('goog-secret');
  });

  it('accepts a model written with the models/ prefix', async () => {
    const { fetch } = stubFetch(() => geminiModels('gemini-2.5-flash'));
    const result = await createGeminiProvider({ fetch }).testConnection({
      apiKey: 'goog-secret',
      model: 'models/gemini-2.5-flash',
    });

    expect(result.ok).toBe(true);
    expect(result.model).toBe('gemini-2.5-flash');
  });

  it('names Gemini, not Anthropic, when the key is refused', async () => {
    const { fetch } = stubFetch(() => jsonResponse({}, 403));
    const result = await createGeminiProvider({ fetch }).testConnection({
      apiKey: 'goog-wrong',
      model: null,
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Google Gemini');
  });
});
