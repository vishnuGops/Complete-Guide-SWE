import {
  CoachProviderError,
  describeNetworkError,
  describeStatus,
  isRetryableStatus,
  judgeModel,
  TEST_CONNECTION_TIMEOUT_MS,
  type CoachProvider,
  type CoachTurn,
  type JsonSchema,
  type ProviderOptions,
  type StreamOptions,
} from './provider.js';
import { COACH_DEFAULT_MODEL, type TokenUsage } from '@devpromax/shared';
import { sseJsonObjects } from './sse.js';

/**
 * Google Gemini (ROADMAP D12).
 *
 * Same shape as the Anthropic check: an authenticated model list, which spends
 * nothing and confirms the configured model in the same round trip. Gemini
 * names models `models/<id>`; the prefix is stripped so settings hold the id the
 * user actually typed.
 */
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** Re-exported from shared, so pricing and dispatch cannot drift apart (P5-6). */
export const GEMINI_DEFAULT_MODEL = COACH_DEFAULT_MODEL.gemini;

interface ModelsResponse {
  models?: { name?: unknown }[];
}

function stripPrefix(name: string): string {
  return name.startsWith('models/') ? name.slice('models/'.length) : name;
}

export function createGeminiProvider(options: ProviderOptions = {}): CoachProvider {
  const doFetch = options.fetch ?? globalThis.fetch;
  const base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

  return {
    id: 'gemini',
    defaultModel: GEMINI_DEFAULT_MODEL,

    async testConnection({ apiKey, model, signal }) {
      const wanted = stripPrefix(model ?? GEMINI_DEFAULT_MODEL);
      const timeout = AbortSignal.timeout(TEST_CONNECTION_TIMEOUT_MS);

      let response: Response;
      try {
        // The key goes in a header rather than the query string: a URL carrying
        // a secret ends up in error messages and logs, and this one must not
        // (CLAUDE.md > Secrets).
        response = await doFetch(`${base}/models?pageSize=200`, {
          method: 'GET',
          headers: { 'x-goog-api-key': apiKey },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        return { ok: false, message: describeNetworkError('gemini', error), model: wanted };
      }

      if (!response.ok) {
        return { ok: false, message: describeStatus('gemini', response.status), model: wanted };
      }

      // `null` until a model list is actually read: a 200 carrying something
      // else is not a connection to Gemini (ROADMAP P5-10).
      let available: string[] | null = null;
      try {
        const body = (await response.json()) as ModelsResponse;
        const names = (Array.isArray(body.models) ? body.models : [])
          .map((entry) => entry.name)
          .filter((name): name is string => typeof name === 'string')
          .map(stripPrefix);
        // Empty means unreadable, for the reason the Anthropic adapter gives.
        available = names.length > 0 ? names : null;
      } catch {
        available = null;
      }

      return judgeModel('gemini', wanted, available);
    },

    /**
     * The coaching turn (P5-1).
     *
     * Gemini's equivalents of the three things the Anthropic side asks for:
     *
     *   - `systemInstruction` for the static half of the prompt. There is no
     *     cache-control to set - Gemini's implicit caching decides for itself -
     *     but keeping the split means the prompt is built the same way for both,
     *     and a future explicit cache has the seam it needs.
     *   - `responseMimeType` + `responseSchema` for structured output. Gemini's
     *     schema dialect is a subset of JSON Schema, so the shared schema is
     *     narrowed on the way in rather than sent as-is.
     *   - No thinking parameter: 2.5-series models reason by default.
     */
    async *stream({
      apiKey,
      model,
      system,
      instructions,
      messages,
      schema,
      signal,
      onUsage,
    }: StreamOptions) {
      const wanted = stripPrefix(model ?? GEMINI_DEFAULT_MODEL);
      const timeout = AbortSignal.timeout(STREAM_TIMEOUT_MS);

      let response: Response;
      try {
        response = await doFetch(
          `${base}/models/${encodeURIComponent(wanted)}:streamGenerateContent?alt=sse`,
          {
            method: 'POST',
            headers: {
              'x-goog-api-key': apiKey,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              // A second part rather than a longer first one, so the rubric
              // prompt stays byte-identical for Gemini's implicit cache (P5-12).
              systemInstruction: {
                parts: [{ text: system }, ...(instructions ? [{ text: instructions }] : [])],
              },
              contents: toGeminiContents(messages),
              generationConfig: {
                ...(schema
                  ? {
                      responseMimeType: 'application/json',
                      responseSchema: toGeminiSchema(schema),
                    }
                  : {}),
                maxOutputTokens: MAX_OUTPUT_TOKENS,
              },
            }),
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          },
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError' && signal?.aborted) {
          throw new CoachProviderError('The request was cancelled.', { cause: error });
        }
        throw new CoachProviderError(describeNetworkError('gemini', error), {
          retryable: true,
          cause: error,
        });
      }

      if (!response.ok) {
        throw new CoachProviderError(describeStatus('gemini', response.status), {
          retryable: isRetryableStatus(response.status),
        });
      }

      if (response.body === null) {
        throw new CoachProviderError('Google Gemini returned an empty response.', {
          retryable: true,
        });
      }

      // Gemini repeats `usageMetadata` on every chunk, each a running total,
      // so the last one seen is the one that counts.
      let usage: TokenUsage | null = null;

      try {
        for await (const chunk of sseJsonObjects(response.body)) {
          const text = extractText(chunk);
          if (text !== '') yield text;

          const reported = extractUsage(chunk);
          if (reported) usage = reported;
        }
      } finally {
        // Reported even when the loop ended badly: a turn cancelled or timed
        // out halfway still used what it used (ROADMAP P5-9).
        if (usage) onUsage?.(usage);
      }
    },
  };
}

/** Same reasoning as the Anthropic cap: truncation would be a parse failure. */
const MAX_OUTPUT_TOKENS = 8192;

const STREAM_TIMEOUT_MS = 120_000;

/**
 * Gemini rejects JSON Schema keywords it does not implement, so the shared
 * schema is filtered down to the subset it accepts rather than sent whole.
 * Dropping a keyword only loosens validation, and the response is re-checked
 * against the real zod schema afterwards either way.
 */
const SUPPORTED_KEYWORDS = new Set([
  'type',
  'format',
  'description',
  'nullable',
  'enum',
  'items',
  'properties',
  'required',
  'minimum',
  'maximum',
]);

function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = {};

  for (const [key, value] of Object.entries(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) continue;

    if (key === 'properties' && typeof value === 'object' && value !== null) {
      const properties: JsonSchema = {};
      for (const [name, child] of Object.entries(value as Record<string, unknown>)) {
        properties[name] = toGeminiSchema(child as JsonSchema);
      }
      out[key] = properties;
    } else if (key === 'items' && typeof value === 'object' && value !== null) {
      out[key] = toGeminiSchema(value as JsonSchema);
    } else {
      out[key] = value;
    }
  }

  return out;
}

interface GeminiChunk {
  candidates?: { content?: { parts?: { text?: unknown }[] } }[];
  usageMetadata?: {
    promptTokenCount?: unknown;
    candidatesTokenCount?: unknown;
    thoughtsTokenCount?: unknown;
  };
}

function extractUsage(chunk: Record<string, unknown>): TokenUsage | null {
  const meta = (chunk as GeminiChunk).usageMetadata;
  if (!meta) return null;
  const inputTokens = typeof meta.promptTokenCount === 'number' ? meta.promptTokenCount : 0;
  const answer = typeof meta.candidatesTokenCount === 'number' ? meta.candidatesTokenCount : 0;
  // 2.5-series models think by default, report it separately, and bill it as
  // output (P5-13). Counting only the answer recorded the larger half of every
  // turn as free.
  const thoughts = typeof meta.thoughtsTokenCount === 'number' ? meta.thoughtsTokenCount : 0;
  const outputTokens = answer + thoughts;
  return inputTokens === 0 && outputTokens === 0 ? null : { inputTokens, outputTokens };
}

/**
 * Pulls the text out of one streamed chunk.
 *
 * Every level is optional because a chunk can carry a safety verdict, a finish
 * reason or usage metadata and no text at all. Those are not errors, they are
 * just not text, so the shape is checked rather than assumed.
 */
function extractText(chunk: Record<string, unknown>): string {
  const candidates = (chunk as GeminiChunk).candidates ?? [];
  let text = '';
  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === 'string') text += part.text;
    }
  }
  return text;
}

/**
 * Gemini's `contents`, with consecutive same-role turns merged (ROADMAP P5-9).
 *
 * Gemini requires the roles to alternate and answers 400 when they do not.
 * That is reachable from ordinary use: a chat turn whose vendor request failed
 * leaves the user's question in the conversation with no reply after it, so the
 * next question makes two `user` turns in a row - and from then on every
 * request in that conversation is rejected, which looks like the key breaking
 * rather than one turn having failed an hour ago.
 *
 * Merged here rather than papered over in the caller because it is this
 * vendor's rule: Anthropic accepts the same history unchanged.
 */
export function toGeminiContents(
  messages: readonly CoachTurn[],
): { role: string; parts: { text: string }[] }[] {
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const turn of messages) {
    const role = turn.role === 'coach' ? 'model' : 'user';
    const last = contents.at(-1);
    if (last?.role === role) {
      last.parts.push({ text: turn.content });
      continue;
    }
    contents.push({ role, parts: [{ text: turn.content }] });
  }

  return contents;
}
