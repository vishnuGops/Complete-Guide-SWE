import Anthropic from '@anthropic-ai/sdk';
import { transformJSONSchema } from '@anthropic-ai/sdk/lib/transform-json-schema';
import {
  anthropicCapabilities,
  COACH_DEFAULT_MODEL,
  ESTIMATED_THINKING_TOKENS,
  estimateTokensFromChars,
} from '@devpromax/shared';
import {
  CoachProviderError,
  describeNetworkError,
  describeRefusedRequest,
  describeStatus,
  describeUnknownModel,
  isRetryableStatus,
  judgeModel,
  TEST_CONNECTION_TIMEOUT_MS,
  type CoachProvider,
  type CoachTurn,
  type FetchLike,
  type JsonSchema,
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
 */
const MAX_TOKENS = 32_000;

/**
 * A model that does not think writes only the answer (P5-11), and the older
 * ones cap output well below 32k - asking for more than a model can produce is
 * a 400, not a larger allowance.
 */
const MAX_TOKENS_WITHOUT_THINKING = 8_192;

/**
 * How hard to think, by kind of turn (ROADMAP P5-9, P5-13).
 *
 * A review is scored against five rubric dimensions: that is reasoning, but it
 * is not research, and medium is where the answer stops improving for it. A
 * follow-up question or an interviewer's line is a short piece of prose about
 * something already reasoned through, and paying medium-effort thinking for
 * "why is that O(n)?" was most of what a chat turn cost.
 */
const REVIEW_EFFORT = 'medium' as const;
const PROSE_EFFORT = 'low' as const;

/**
 * How long to wait for the response to *start* (ROADMAP P5-11).
 *
 * The SDK's `timeout` covers the request until its headers arrive and nothing
 * after, which the comment that used to sit here - "long enough that a slow
 * think cannot be mistaken for a hang" - had backwards: a streaming response
 * sends its headers at once and thinks afterwards, so this never bounded a
 * think at all. What bounds a stalled stream is the idle watchdog below.
 */
const HEADERS_TIMEOUT_MS = 60_000;

/**
 * How long an open stream may go without a byte before it is given up on.
 *
 * Anthropic keeps a healthy stream busy - text and thinking deltas, and `ping`
 * events between them, which the SDK swallows before our loop sees them. So the
 * watchdog listens to the bytes rather than to the events, and ninety seconds
 * of true silence is a connection that has died without closing: before this,
 * nothing ended such a turn except the user noticing.
 */
const STREAM_IDLE_MS = 90_000;

/**
 * One retry, not the SDK's two (ROADMAP P5-11).
 *
 * A retry of a streamed turn is a whole new turn, billed again from the start.
 * One absorbs a transient 529 before anything was written; a second, on a
 * vendor that has just failed twice, is more likely to double the bill than to
 * produce an answer, and the panel already offers "try again" for the rest.
 */
const STREAM_MAX_RETRIES = 1;

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
 * The response schema in the dialect structured outputs accept (ROADMAP P5-11).
 *
 * zod's JSON Schema carries `$schema`, `minLength`, `maximum`, `default` and no
 * `additionalProperties: false` - every one of which the vendor refuses, so the
 * schema as it stood made every AI Help click a 400. The SDK's own transform
 * does the narrowing: it knows the vendor's rules and moves each constraint it
 * drops into the field's description, where the model still reads it. Ours
 * would be a second copy of those rules, out of date the first time they
 * change. The dropped constraints are still enforced - the answer is parsed
 * with the real zod schema in `feedback.ts` either way.
 *
 * `$schema` is taken off first, because the transform would otherwise keep it
 * as a sentence of description on the root.
 */
export function toAnthropicSchema(schema: JsonSchema): JsonSchema {
  const { $schema: _dialect, ...rest } = schema;
  return transformJSONSchema(rest);
}

/** One turn in the Messages API's shape, with a cache breakpoint if asked (P5-13). */
function toMessage(turn: CoachTurn): Anthropic.MessageParam {
  const role = turn.role === 'coach' ? 'assistant' : 'user';
  if (!turn.cacheBreakpoint) return { role, content: turn.content };
  return {
    role,
    content: [{ type: 'text', text: turn.content, cache_control: { type: 'ephemeral' } }],
  };
}

/** What a request asked for, so an error about it can name it. */
interface RequestFacts {
  model: string;
  apiKey: string;
}

/** The vendor's own explanation out of an SDK error body, when it has one. */
function vendorMessage(error: InstanceType<typeof Anthropic.APIError>): string | null {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return null;
  const inner = (body as { error?: { message?: unknown } }).error;
  return typeof inner?.message === 'string' ? inner.message : null;
}

/**
 * An `error` event in the middle of the stream (ROADMAP P5-11).
 *
 * The status line went out as a 200 before the first token, so these arrive as
 * an SDK error with no status at all - and the old mapping only knew statuses,
 * so a vendor that was merely overloaded halfway through an answer was reported
 * as "failed unexpectedly", with no retry offered, which is the one case where
 * trying again is exactly right. The event's `type` is what says which it was.
 */
function fromStreamError(
  error: InstanceType<typeof Anthropic.APIError>,
  request?: RequestFacts,
): CoachProviderError {
  switch (error.type) {
    case 'overloaded_error':
      return new CoachProviderError(
        'Anthropic is overloaded right now and stopped partway through the answer. Try again in a minute.',
        { retryable: true, cause: error },
      );
    case 'rate_limit_error':
      return new CoachProviderError(describeStatus('anthropic', 429), {
        retryable: true,
        cause: error,
      });
    case 'api_error':
    case 'timeout_error':
      return new CoachProviderError(
        'Anthropic hit an error on their side partway through the answer. That is not yours to fix; try again.',
        { retryable: true, cause: error },
      );
    default:
      return new CoachProviderError(
        describeRefusedRequest('anthropic', vendorMessage(error), request?.apiKey ?? ''),
        { cause: error },
      );
  }
}

/**
 * Maps an SDK error onto something actionable.
 *
 * Checked most specific first, as the SDK's own guidance says. The vendor's
 * message body is forwarded for a 400 only, trimmed and scrubbed - see
 * `describeRefusedRequest` for why that one status is different.
 */
function toCoachError(error: unknown, request?: RequestFacts): CoachProviderError {
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
  if (error instanceof Anthropic.APIError) {
    if (typeof error.status !== 'number') return fromStreamError(error, request);

    // Only on the messages endpoint: there, the route exists and what the
    // vendor could not find is the model. The key check's 404 still means the
    // endpoint, and keeps `describeStatus`'s wording.
    if (error.status === 404 && request) {
      return new CoachProviderError(describeUnknownModel('anthropic', request.model), {
        cause: error,
      });
    }
    if (error.status === 400 && request) {
      return new CoachProviderError(
        describeRefusedRequest('anthropic', vendorMessage(error), request.apiKey),
        { cause: error },
      );
    }
    return new CoachProviderError(describeStatus('anthropic', error.status), {
      retryable: isRetryableStatus(error.status),
      cause: error,
    });
  }
  return new CoachProviderError('The coach request failed unexpectedly.', { cause: error });
}

/**
 * The idle watchdog (ROADMAP P5-11): a signal that fires when the response body
 * has been silent for `ms`, re-armed by every chunk of bytes.
 *
 * Bytes rather than events, because the SDK drops `ping` before our loop sees
 * it, and a long think is a stretch of pings with no events between them.
 * Wrapped around `fetch` because that is the one place the raw body passes.
 */
function createWatchdog(ms: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let fired = false;

  const stop = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const arm = () => {
    stop();
    timer = setTimeout(() => {
      fired = true;
      controller.abort(new DOMException('The stream went quiet.', 'TimeoutError'));
    }, ms);
    // Never the reason the process stays up.
    timer.unref?.();
  };

  const wrap =
    (inner: FetchLike): FetchLike =>
    async (input, init) => {
      const response = await inner(input, init);
      if (response.body === null) return response;

      arm();
      const body = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, out) {
            arm();
            out.enqueue(chunk);
          },
          flush() {
            stop();
          },
        }),
      );
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    };

  return {
    signal: controller.signal,
    wrap,
    stop,
    fired: () => fired,
  };
}

function idleError(ms: number): CoachProviderError {
  return new CoachProviderError(
    `Anthropic stopped sending for ${String(Math.round(ms / 1000))} seconds, so the answer was abandoned. Try again.`,
    { retryable: true },
  );
}

/**
 * The model declined to finish (ROADMAP P5-11).
 *
 * Not retryable: the same code and the same question meet the same filter.
 * Worth saying plainly that the key is fine, because a turn that ended with no
 * answer and a generic error reads as "my setup is broken".
 */
function refusalError(details: Anthropic.RefusalStopDetails | null): CoachProviderError {
  const why =
    typeof details?.explanation === 'string' && details.explanation.trim() !== ''
      ? ` (${details.explanation.trim().slice(0, 200)})`
      : '';
  return new CoachProviderError(
    `Anthropic's safety system stopped this answer${why}. Nothing is wrong with your key; asking again about the same code will most likely stop the same way.`,
  );
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
     * Four things here are deliberate:
     *
     *   - **`cache_control` on the system prompt**, and on the last turn of
     *     history when the caller marks one (P5-13). The system prompt is the
     *     same bytes on every click, and a follow-up resends the review it is
     *     about on every question. Caching is a prefix match, so the volatile
     *     parts - the new message, a follow-up's `instructions` - come after
     *     the breakpoints or carry none.
     *   - **`output_config.format`**, in the vendor's dialect (P5-11). The
     *     rubric card and the status engine read fields off this object (D13);
     *     asking for JSON in prose and hoping would put a parse failure between
     *     the user and their feedback.
     *   - **Adaptive thinking, only where the model takes it** (P5-11). Scoring
     *     five rubric dimensions against real code is reasoning, and it is the
     *     part users notice being wrong. The thinking itself is never yielded -
     *     the user asked for feedback, not a transcript of deliberation - but
     *     `max_tokens` has to cover it, which is what P5-9 fixed. Haiku 4.5 and
     *     older refuse the parameter outright, so they are asked without it.
     *   - **What an unfinished turn cost.** See the `finally` below.
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
      const wanted = model ?? ANTHROPIC_DEFAULT_MODEL;
      const thinks = anthropicCapabilities(wanted).adaptiveThinking;
      const maxTokens = thinks ? MAX_TOKENS : MAX_TOKENS_WITHOUT_THINKING;
      const idleMs = options.streamIdleMs ?? STREAM_IDLE_MS;

      const watchdog = createWatchdog(idleMs);
      const client = createClient(apiKey, {
        ...options,
        fetch: watchdog.wrap(options.fetch ?? globalThis.fetch),
      });
      const abort = signal ? AbortSignal.any([signal, watchdog.signal]) : watchdog.signal;
      const facts: RequestFacts = { model: wanted, apiKey };

      // Left off entirely when it would be empty: an older model given an
      // `output_config` it has no use for is one more field to refuse.
      const outputConfig = {
        ...(thinks ? { effort: schema ? REVIEW_EFFORT : PROSE_EFFORT } : {}),
        ...(schema
          ? { format: { type: 'json_schema' as const, schema: toAnthropicSchema(schema) } }
          : {}),
      };

      try {
        const stream = client.messages.stream(
          {
            model: wanted,
            max_tokens: maxTokens,
            ...(thinks ? { thinking: { type: 'adaptive' as const } } : {}),
            system: [
              { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
              ...(instructions ? [{ type: 'text' as const, text: instructions }] : []),
            ],
            messages: messages.map(toMessage),
            ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
          },
          { signal: abort, timeout: HEADERS_TIMEOUT_MS, maxRetries: STREAM_MAX_RETRIES },
        );

        // Anthropic splits usage across two events: the input counts arrive
        // with `message_start`, the final output count with `message_delta`.
        let inputTokens = 0;
        let outputTokens = 0;
        let cacheWriteTokens = 0;
        let cacheReadTokens = 0;
        let stopReason: string | null = null;
        let stopDetails: Anthropic.RefusalStopDetails | null = null;
        let finalCount = false;
        // Everything the model was seen to write, thinking included, for the
        // estimate a turn that never reported its output count is charged.
        let writtenChars = 0;

        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                writtenChars += event.delta.text.length;
                yield event.delta.text;
              } else if (event.delta.type === 'thinking_delta') {
                writtenChars += event.delta.thinking.length;
              }
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
              finalCount = true;
              outputTokens = event.usage.output_tokens;
              stopReason = event.delta.stop_reason ?? stopReason;
              stopDetails = event.delta.stop_details ?? stopDetails;
            }
          }
        } finally {
          /*
           * In a `finally`, because a turn that timed out or was cancelled
           * halfway still consumed everything the vendor counted up to that
           * point (P5-9). Reporting only on success recorded those as free,
           * which is the one direction a spend cap must never be wrong in.
           *
           * And estimated when the final count never came (P5-13). The output
           * figure on `message_start` is a placeholder of about one token, so a
           * turn stopped after a minute of thinking was recorded as having
           * written nothing. What was seen streaming is a floor; a model that
           * thinks is charged the thinking allowance on top, since that is what
           * it was most likely doing when it stopped.
           */
          if (!finalCount && inputTokens + cacheWriteTokens + cacheReadTokens > 0) {
            const estimate =
              estimateTokensFromChars(writtenChars) + (thinks ? ESTIMATED_THINKING_TOKENS : 0);
            outputTokens = Math.max(outputTokens, estimate);
          }
          if (inputTokens > 0 || outputTokens > 0 || cacheWriteTokens > 0) {
            onUsage?.({
              inputTokens,
              outputTokens,
              ...(cacheWriteTokens > 0 ? { cacheWriteTokens } : {}),
              ...(cacheReadTokens > 0 ? { cacheReadTokens } : {}),
            });
          }
        }

        // The SDK ends the loop quietly when its signal aborts, so a watchdog
        // that fired has to be asked about rather than caught.
        if (watchdog.fired()) throw idleError(idleMs);

        if (stopReason === 'refusal') throw refusalError(stopDetails);

        // A document that stopped at the ceiling is not a retryable glitch: the
        // same request produces the same truncation, and the caller's "cut off,
        // try again" would spend the whole turn a second time to find that out.
        if (stopReason === 'max_tokens') {
          throw new CoachProviderError(
            `The coach's answer hit the ${String(maxTokens)}-token ceiling before it finished. Ask about less code at once, or raise it.`,
          );
        }
        if (stopReason === 'model_context_window_exceeded') {
          throw new CoachProviderError(
            'This conversation no longer fits in the model’s context window. Start a new conversation.',
          );
        }
      } catch (error) {
        if (watchdog.fired()) throw idleError(idleMs);
        throw toCoachError(error, facts);
      } finally {
        watchdog.stop();
      }
    },
  };
}
