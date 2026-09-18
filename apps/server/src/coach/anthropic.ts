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
 * Generous because the cap is a safety net, not a budget.
 *
 * Feedback runs to a few thousand tokens; the spend cap in P5-6 is what actually
 * limits cost. A tight `max_tokens` here would truncate the JSON mid-string and
 * turn a long answer into a parse failure, which is a much worse outcome than a
 * long answer.
 */
const MAX_TOKENS = 8192;

/** A coaching turn is short. Past this, something is wrong rather than slow. */
const STREAM_TIMEOUT_MS = 120_000;

function createClient(apiKey: string, options: ProviderOptions): Anthropic {
  return new Anthropic({
    apiKey,
    // Injected in tests, which never reach the network (D17). The SDK takes a
    // `fetch` override, so the seam is the vendor's own rather than one we had
    // to invent around it.
    ...(options.fetch ? { fetch: options.fetch } : {}),
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

      let available: string[] = [];
      try {
        const page = await client.models.list(
          { limit: 100 },
          { signal, timeout: TEST_CONNECTION_TIMEOUT_MS },
        );
        // A 200 already proves the key works; a body we cannot read only costs
        // the model check, which is not worth failing the whole test over.
        const body = page as unknown as ModelsResponse;
        available = (body.data ?? [])
          .map((entry) => entry.id)
          .filter((id): id is string => typeof id === 'string');
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
     *   - **Adaptive thinking.** Scoring five rubric dimensions against real code
     *     is reasoning, and it is the part users notice being wrong. `display` is
     *     left at its default, so the thinking is never streamed to the panel -
     *     the user asked for feedback, not for a transcript of deliberation.
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
            ...(schema ? { output_config: { format: { type: 'json_schema', schema } } } : {}),
          },
          { signal, timeout: STREAM_TIMEOUT_MS },
        );

        // Anthropic splits usage across two events: the input count arrives
        // with `message_start`, the final output count with `message_delta`.
        let inputTokens = 0;
        let outputTokens = 0;

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield event.delta.text;
            continue;
          }
          if (event.type === 'message_start') {
            inputTokens = event.message.usage.input_tokens;
            outputTokens = event.message.usage.output_tokens;
            continue;
          }
          if (event.type === 'message_delta') {
            outputTokens = event.usage.output_tokens;
          }
        }

        if (inputTokens > 0 || outputTokens > 0) onUsage?.({ inputTokens, outputTokens });
      } catch (error) {
        throw toCoachError(error);
      }
    },
  };
}
