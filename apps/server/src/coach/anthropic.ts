import Anthropic from '@anthropic-ai/sdk';
import { COACH_DEFAULT_MODEL } from '@devpromax/shared';
import {
  CoachProviderError,
  describeNetworkError,
  describeStatus,
  isRetryableStatus,
  judgeModel,
  TEST_CONNECTION_TIMEOUT_MS,
  type CoachProvider,
  type ProviderOptions,
  type StreamOptions,
} from './provider.js';

/**
 * Anthropic (ROADMAP D12, P5-1).
 *
 * Through the official SDK rather than `fetch`: see the dependency note in
 * `provider.ts`. The SDK owns SSE framing, retries and typed errors, and this
 * file owns the two things it cannot know about - what our prompt looks like,
 * and what our user should be told when something goes wrong.
 */

/** Re-exported from shared, so pricing and dispatch cannot drift apart (P5-6). */
export const ANTHROPIC_DEFAULT_MODEL = COACH_DEFAULT_MODEL.anthropic;

/**
 * Room for the thinking *and* the answer (ROADMAP P5-9).
 *
 * `max_tokens` bounds everything the model generates, adaptive thinking
 * included, so 8192 was a budget in which a thorough think left no room to
 * write the JSON it had planned. The document then arrived truncated, was
 * reported as "cut off, retryable", and the retry did the same thing again at
 * full price - the worst possible shape for a cost bug: it charges twice for
 * nothing and tells the user to try a third time.
 *
 * Paired with `effort: 'medium'`. Scoring five rubric dimensions is reasoning,
 * but it is not research; medium is the level at which the answer stops
 * improving for this task, and it is a third of the thinking tokens of the
 * default.
 */
const MAX_TOKENS = 32_000;
const EFFORT = 'medium' as const;

/**
 * A ceiling, not an expectation.
 *
 * Long enough that a slow think cannot be mistaken for a hang, which is the
 * reason it moved: at two minutes a request that would have answered was killed
 * and billed. The user's own Stop button is the fast path out (P5-9), and it
 * now actually cancels the vendor request.
 */
const STREAM_TIMEOUT_MS = 300_000;

function createClient(apiKey: string, options: ProviderOptions): Anthropic {
  return new Anthropic({
    apiKey,
    // Injected in tests, which never reach the network (D17). The SDK takes a
    // `fetch` override, so the seam is the vendor's own rather than one we had
    // to invent around it.
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.baseUrl ? { baseURL: options.baseUrl } : {}),
  });
}

/**
 * Maps an SDK error onto something actionable.
 *
 * Checked most specific first, as the SDK's own guidance says; the vendor's
 * message body is deliberately not forwarded (same reasoning as
 * `describeStatus`).
 */
function toCoachError(error: unknown): CoachProviderError {
  // Already ours, already worded for a person: the truncation message below
  // passes through here and must not be flattened into "failed unexpectedly".
  if (error instanceof CoachProviderError) return error;
  if (error instanceof Anthropic.APIUserAbortError) {
    return new CoachProviderError('The request was cancelled.');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new CoachProviderError(describeNetworkError('anthropic', error), {
      retryable: true,
      cause: error,
    });
  }
  if (error instanceof Anthropic.APIError && typeof error.status === 'number') {
    return new CoachProviderError(describeStatus('anthropic', error.status), {
      retryable: isRetryableStatus(error.status),
      cause: error,
    });
  }
  return new CoachProviderError('The coach request failed unexpectedly.', { cause: error });
}

interface ModelsResponse {
  data?: { id?: unknown }[];
}

export function createAnthropicProvider(options: ProviderOptions = {}): CoachProvider {
  return {
    id: 'anthropic',
    defaultModel: ANTHROPIC_DEFAULT_MODEL,

    /**
     * `GET /v1/models` through the SDK: authenticated, spends no tokens, and
     * returns the model list, so one request answers both "is this key valid"
     * and "does the configured model exist".
     */
    async testConnection({ apiKey, model, signal }) {
      const wanted = model ?? ANTHROPIC_DEFAULT_MODEL;
      const client = createClient(apiKey, options);

      // `null` until a model list is actually read: a 200 carrying something
      // else is not a connection to Anthropic (P5-10).
      let available: string[] | null = null;
      try {
        const page = await client.models.list(
          { limit: 100 },
          { signal, timeout: TEST_CONNECTION_TIMEOUT_MS },
        );
        const body = page as unknown as ModelsResponse;
        const ids = (Array.isArray(body.data) ? body.data : [])
          .map((entry) => entry.id)
          .filter((id): id is string => typeof id === 'string');
        // An *empty* list counts as unreadable here, not as "connected but
        // unverified": the SDK's page object defaults `data` to `[]`, so a 200
        // carrying an HTML page is indistinguishable from one carrying no
        // models - and the real endpoint never answers with no models for a
        // valid key (P5-10).
        available = ids.length > 0 ? ids : null;
      } catch (error) {
        const mapped = toCoachError(error);
        return { ok: false, message: mapped.message, model: wanted };
      }

      return judgeModel('anthropic', wanted, available);
    },

    /**
     * The coaching turn.
     *
     * Three things here are deliberate:
     *
     *   - **`cache_control` on the system prompt.** It is the same bytes on every
     *     AI Help click in a session, and it is the largest stable part of the
     *     request, so caching it is most of the saving available (D12). Caching
     *     is a prefix match, so the volatile half - code, judge results - has to
     *     come after it, which is why `system` and `messages` are separate
     *     parameters on our interface rather than one list.
     *   - **`output_config.format`.** The rubric card and the status engine read
     *     fields off this object (D13); asking for JSON in prose and hoping
     *     would put a parse failure between the user and their feedback.
     *   - **Adaptive thinking at medium effort.** Scoring five rubric dimensions
     *     against real code is reasoning, and it is the part users notice being
     *     wrong. `display` is left at its default, so the thinking is never
     *     streamed to the panel - the user asked for feedback, not for a
     *     transcript of deliberation - and `max_tokens` has to cover it, which
     *     is what P5-9 fixed.
     */
    async *stream({ apiKey, model, system, messages, schema, signal, onUsage }: StreamOptions) {
      const client = createClient(apiKey, options);

      try {
        const stream = client.messages.stream(
          {
            model: model ?? ANTHROPIC_DEFAULT_MODEL,
            max_tokens: MAX_TOKENS,
            thinking: { type: 'adaptive' },
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages: messages.map((turn) => ({
              role: turn.role === 'coach' ? ('assistant' as const) : ('user' as const),
              content: turn.content,
            })),
            output_config: {
              effort: EFFORT,
              ...(schema ? { format: { type: 'json_schema' as const, schema } } : {}),
            },
          },
          { signal, timeout: STREAM_TIMEOUT_MS },
        );

        // Anthropic splits usage across two events: the input counts arrive
        // with `message_start`, the final output count with `message_delta`.
        let inputTokens = 0;
        let outputTokens = 0;
        let cacheWriteTokens = 0;
        let cacheReadTokens = 0;
        let stopReason: string | null = null;

        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              yield event.delta.text;
              continue;
            }
            if (event.type === 'message_start') {
              const usage = event.message.usage;
              inputTokens = usage.input_tokens;
              outputTokens = usage.output_tokens;
              // Where the cached system prompt is billed (P5-9). Absent on a
              // vendor or model that does not report them, hence `?? 0`.
              cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
              cacheReadTokens = usage.cache_read_input_tokens ?? 0;
              continue;
            }
            if (event.type === 'message_delta') {
              outputTokens = event.usage.output_tokens;
              stopReason = event.delta.stop_reason ?? stopReason;
            }
          }
        } finally {
          // In a `finally`, because a turn that timed out or was cancelled
          // halfway still consumed everything the vendor counted up to that
          // point (P5-9). Reporting only on success recorded those as free,
          // which is the one direction a spend cap must never be wrong in.
          if (inputTokens > 0 || outputTokens > 0 || cacheWriteTokens > 0) {
            onUsage?.({
              inputTokens,
              outputTokens,
              ...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}),
              ...(cacheReadTokens > 0 ? { cacheReadTokens } : {}),
            });
          }
        }

        // A document that stopped at the ceiling is not a retryable glitch: the
        // same request produces the same truncation, and the caller's "cut off,
        // try again" would spend the whole turn a second time to find that out.
        if (stopReason === 'max_tokens') {
          throw new CoachProviderError(
            `The coach's answer hit the ${String(MAX_TOKENS)}-token ceiling before it finished. Ask about less code at once, or raise it.`,
          );
        }
      } catch (error) {
        throw toCoachError(error);
      }
    },
  };
}
