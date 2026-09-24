import { COACH_DEFAULT_MODEL, type TokenUsage } from '@devpromax/shared';
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
import { sseJsonObjects } from './sse.js';

/**
 * Any endpoint that speaks OpenAI's chat API (ROADMAP P9-4).
 *
 * The point of this one is not OpenAI. It is Ollama, LM Studio, llama.cpp's
 * server, vLLM and every gateway in front of them - which all implement the
 * same two routes - so that a user who wants coaching without a request leaving
 * the machine can have it. `baseUrl` is therefore a *setting* rather than an
 * environment override: for the other two providers the address is a fact about
 * the vendor, and for this one it is the whole configuration.
 *
 * Two things follow from the endpoint being the user's own.
 *
 * **Cost is unknown here** (`MODEL_PRICES['openai-compatible']` is empty). A
 * local model costs nothing and a hosted gateway costs whatever its owner
 * charges; inventing a number for either would be worse than admitting it, so
 * the spend cap has nothing to police and Settings says so.
 *
 * **Structured output is negotiated rather than assumed.** `json_schema` is the
 * standard and the better answer, but plenty of small servers still only do
 * `json_object`; a single 400 for an unsupported `response_format` would make
 * the coach unusable against them. So a rejected schema is retried once in the
 * looser mode. The answer is re-validated against the real zod schema either
 * way (`feedback.ts`), so the looser mode costs strictness at the vendor, not
 * correctness here.
 */

/** Ollama's default, because it is the one most people have running. */
const DEFAULT_BASE_URL = 'http://127.0.0.1:11434/v1';

/** Re-exported from shared, so pricing and dispatch cannot drift apart. */
export const OPENAI_COMPATIBLE_DEFAULT_MODEL = COACH_DEFAULT_MODEL['openai-compatible'];

const MAX_OUTPUT_TOKENS = 8192;
const STREAM_TIMEOUT_MS = 180_000;

interface ModelsResponse {
  data?: { id?: unknown }[];
}

interface ChatChunk {
  choices?: { delta?: { content?: unknown } }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } | null;
}

function toMessages(system: string, instructions: string | undefined, turns: readonly CoachTurn[]) {
  return [
    // Joined into the one system message: plenty of the small servers this is
    // for accept exactly one, first (P5-12).
    { role: 'system', content: instructions ? `${system}\n\n${instructions}` : system },
    ...turns.map((turn) => ({
      // The two roles both other vendors share, in this API's spelling.
      role: turn.role === 'coach' ? 'assistant' : 'user',
      content: turn.content,
    })),
  ];
}

function extractText(chunk: ChatChunk): string {
  const content = chunk.choices?.[0]?.delta?.content;
  return typeof content === 'string' ? content : '';
}

function extractUsage(chunk: ChatChunk): TokenUsage | null {
  const usage = chunk.usage;
  if (!usage) return null;
  const input = usage.prompt_tokens;
  const output = usage.completion_tokens;
  if (typeof input !== 'number' || typeof output !== 'number') return null;
  return { inputTokens: input, outputTokens: output };
}

/** Whether a 4xx is the server saying it does not do `json_schema`. */
function looksLikeSchemaRefusal(status: number, body: string): boolean {
  if (status !== 400 && status !== 422 && status !== 404 && status !== 501) return false;
  const text = body.toLowerCase();
  return (
    text.includes('response_format') ||
    text.includes('json_schema') ||
    text.includes('not supported') ||
    text.includes('unsupported')
  );
}

export function createOpenAiCompatibleProvider(options: ProviderOptions = {}): CoachProvider {
  const doFetch = options.fetch ?? globalThis.fetch;
  const base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

  return {
    id: 'openai-compatible',
    defaultModel: OPENAI_COMPATIBLE_DEFAULT_MODEL,

    async testConnection({ apiKey, model, signal }) {
      const wanted = model ?? OPENAI_COMPATIBLE_DEFAULT_MODEL;
      const timeout = AbortSignal.timeout(TEST_CONNECTION_TIMEOUT_MS);

      let response: Response;
      try {
        /*
         * The key goes in the header even when there is not one.
         *
         * A local server usually wants no key at all, and several of them
         * reject a *missing* `Authorization` while ignoring its contents - so
         * an empty key is sent as `Bearer` with nothing after it rather than
         * omitted, which is what those servers expect and what the ones that
         * check keys will reject honestly.
         */
        response = await doFetch(`${base}/models`, {
          method: 'GET',
          headers: { authorization: `Bearer ${apiKey}` },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        return {
          ok: false,
          message: `${describeNetworkError('openai-compatible', error)} It is configured as ${base}.`,
          model: wanted,
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          message: describeStatus('openai-compatible', response.status),
          model: wanted,
        };
      }

      // `null` until a model list is actually read: a 200 carrying something
      // else is not a connection to anything that speaks this API (P5-10).
      let available: string[] | null = null;
      try {
        const body = (await response.json()) as ModelsResponse;
        const ids = (Array.isArray(body.data) ? body.data : [])
          .map((entry) => entry.id)
          .filter((id): id is string => typeof id === 'string');
        available = ids.length > 0 ? ids : null;
      } catch {
        available = null;
      }

      return judgeModel('openai-compatible', wanted, available);
    },

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
      const wanted = model ?? OPENAI_COMPATIBLE_DEFAULT_MODEL;
      const timeout = AbortSignal.timeout(STREAM_TIMEOUT_MS);
      const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;

      const send = async (format: JsonSchema | undefined): Promise<Response> => {
        try {
          return await doFetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: wanted,
              messages: toMessages(system, instructions, messages),
              stream: true,
              // Without this the stream reports no usage at all, and the spend
              // cap would treat every turn as unpriced (P5-6).
              stream_options: { include_usage: true },
              max_tokens: MAX_OUTPUT_TOKENS,
              ...(format ? { response_format: format } : {}),
            }),
            signal: abort,
          });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError' && signal?.aborted) {
            throw new CoachProviderError('The request was cancelled.', { cause: error });
          }
          throw new CoachProviderError(
            `${describeNetworkError('openai-compatible', error)} It is configured as ${base}.`,
            { retryable: true, cause: error },
          );
        }
      };

      const strict: JsonSchema | undefined = schema
        ? { type: 'json_schema', json_schema: { name: 'coach_feedback', schema, strict: true } }
        : undefined;

      let response = await send(strict);

      if (!response.ok && strict) {
        // Read once: the body is the only way to tell "you asked for something
        // I cannot do" from "your key is wrong", and both arrive as a 400 on
        // some servers.
        const body = await response.text().catch(() => '');
        if (looksLikeSchemaRefusal(response.status, body)) {
          response = await send({ type: 'json_object' });
        }
      }

      if (!response.ok) {
        throw new CoachProviderError(describeStatus('openai-compatible', response.status), {
          retryable: isRetryableStatus(response.status),
        });
      }

      if (response.body === null) {
        throw new CoachProviderError('That endpoint returned an empty response.', {
          retryable: true,
        });
      }

      // Reported on the final chunk rather than repeated, so the last one seen
      // is the only one there is.
      let usage: TokenUsage | null = null;

      try {
        for await (const chunk of sseJsonObjects(response.body)) {
          const frame = chunk as ChatChunk;
          const text = extractText(frame);
          if (text !== '') yield text;

          const reported = extractUsage(frame);
          if (reported) usage = reported;
        }
      } finally {
        // Reported even when the loop ended badly: a cancelled turn still used
        // what it used (P5-9).
        if (usage) onUsage?.(usage);
      }
    },
  };
}
