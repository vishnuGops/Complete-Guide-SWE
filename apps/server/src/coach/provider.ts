import {
  COACH_PROVIDER_LABEL,
  type CoachProvider as CoachProviderId,
  type TokenUsage,
} from '@devpromax/shared';

/**
 * The provider seam (ROADMAP D12).
 *
 * Nothing outside this folder may know which vendor is configured: routes and
 * services talk to a `CoachProvider`, and swapping Anthropic for Gemini is a
 * settings change rather than a code change.
 *
 * P5-1 added the `stream()` half and, with it, answered the dependency question
 * P3-4 left open. The answer is different per vendor, which looks inconsistent
 * until you look at what each one is being asked for:
 *
 *   - **Anthropic** goes through the official `@anthropic-ai/sdk`. Streaming
 *     structured output means SSE framing, `content_block_delta` variants,
 *     mid-stream error events and typed error classes - all of it already
 *     written, tested and versioned by the vendor. Hand-rolling that to save one
 *     dependency would be trading a supported implementation for a worse one.
 *   - **Gemini** stays on `fetch`. Its streaming endpoint is a plain
 *     `alt=sse` response of JSON objects, and that is genuinely all there is.
 *
 * Both are injectable and no test in this repo touches the network (D17).
 */

export interface TestConnectionOptions {
  apiKey: string;
  /** null asks the provider to check its own default model. */
  model: string | null;
  signal?: AbortSignal;
}

export interface ConnectionResult {
  ok: boolean;
  /** Shown verbatim in Settings, so it has to say what to do next. */
  message: string;
  /** The model the check resolved to, for the confirmation line. */
  model: string | null;
}

/**
 * One turn of the conversation, in the only two roles both vendors share.
 *
 * The system prompt is not in here: it is passed separately because it is the
 * part that must stay byte-identical across requests to be cacheable, and
 * putting it in the same list as the volatile turns invites it being rebuilt.
 */
export interface CoachTurn {
  role: 'user' | 'coach';
  content: string;
}

export interface StreamOptions {
  apiKey: string;
  /** null asks the provider for its own default. */
  model: string | null;
  /**
   * The static half of the prompt - the rubric, the tone, the rules. Identical
   * on every request so Anthropic can cache it (D12); see `anthropic.ts`.
   */
  system: string;
  /** Problem, code, judge results and prior attempts. Different every time. */
  messages: readonly CoachTurn[];
  /**
   * JSON Schema the response must satisfy. Shared so the two vendors cannot
   * drift into accepting different shapes; built from the zod schema in
   * `feedback.ts` so it cannot drift from the parser either.
   *
   * Omitted for plain-prose turns such as a follow-up chat reply (P5-3).
   * Asking for a bare JSON string instead would be worse than asking for
   * nothing: the answer would arrive quoted and escaped, and the panel would
   * render the escapes.
   */
  schema?: JsonSchema;
  signal?: AbortSignal;
  /**
   * What the turn actually used, reported when the vendor says so (P5-6).
   *
   * A callback rather than a yielded value, because usage is not part of the
   * answer: the stream yields the text the panel paints, and threading a second
   * kind of item through it would make every consumer branch on something only
   * the spend cap cares about. Not called when a vendor reports nothing, which
   * is why the cap treats a missing report as its estimate rather than as zero.
   */
  onUsage?: (usage: TokenUsage) => void;
}

/** Just enough of JSON Schema to name what crosses the provider seam. */
export type JsonSchema = Record<string, unknown>;

export interface CoachProvider {
  readonly id: CoachProviderId;
  /** Used when the user has not picked a model. */
  readonly defaultModel: string;
  testConnection(options: TestConnectionOptions): Promise<ConnectionResult>;
  /**
   * Streams the raw JSON response as it is generated.
   *
   * Deliberately yields *text*, not parsed objects: the document is incomplete
   * until the last chunk, so there is nothing to parse yet, and both vendors can
   * honestly produce this. Turning the pieces into markdown deltas and a
   * validated `CoachFeedback` is `feedback.ts`'s job, once, for both.
   */
  stream(options: StreamOptions): AsyncIterable<string>;
}

export type FetchLike = typeof fetch;

export interface ProviderOptions {
  /** Swapped out in tests; there is no network in CI (ROADMAP P5-7). */
  fetch?: FetchLike;
}

/**
 * A provider failure with a message fit to show the user.
 *
 * The thing this class exists to stop is a vendor's raw error reaching the Coach
 * panel. "400 invalid_request_error: messages.1: ..." is written for an API
 * integrator; someone practising binary search needs "the key was rejected,
 * paste a different one". `retryable` separates "try again" from "change
 * something" so the UI can offer the right button (P5-3).
 */
export class CoachProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'CoachProviderError';
    this.retryable = options.retryable ?? false;
  }
}

/** Statuses worth a second attempt: rate limits and the vendor's own outages. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** How long a key check may take before it is abandoned. */
export const TEST_CONNECTION_TIMEOUT_MS = 15_000;

/**
 * Turns an HTTP status into something a user can act on.
 *
 * "Request failed with status 401" tells the user nothing they can do; "the key
 * was rejected" tells them to paste a different one. The vendor's own error body
 * is deliberately not forwarded - it is written for API integrators, not for
 * someone who just wants to practise binary search.
 */
export function describeStatus(id: CoachProviderId, status: number): string {
  const vendor = COACH_PROVIDER_LABEL[id];
  if (status === 401 || status === 403) {
    return `${vendor} rejected that API key. Check that it was copied whole and has not been revoked.`;
  }
  if (status === 404) {
    return `${vendor} does not recognise that endpoint. The key may be for a different product.`;
  }
  if (status === 429) {
    return `${vendor} is rate-limiting this key right now. Try again in a minute.`;
  }
  if (status >= 500) {
    return `${vendor} returned a server error (${status}). That is their side, not yours.`;
  }
  return `${vendor} refused the request (HTTP ${status}).`;
}

export function describeNetworkError(id: CoachProviderId, error: unknown): string {
  const vendor = COACH_PROVIDER_LABEL[id];
  if (error instanceof Error && error.name === 'AbortError') {
    return `${vendor} did not answer within ${TEST_CONNECTION_TIMEOUT_MS / 1000} seconds.`;
  }
  return `Could not reach ${vendor}. Check that this machine is online.`;
}

/**
 * A model list from the provider, used to answer "does the configured model
 * exist" before the user discovers it does not halfway through a coaching
 * session. An empty list means the provider answered but told us nothing useful,
 * which is not a reason to fail the check.
 */
export function judgeModel(
  id: CoachProviderId,
  model: string,
  available: readonly string[],
): ConnectionResult {
  const vendor = COACH_PROVIDER_LABEL[id];
  if (available.length === 0 || available.includes(model)) {
    return { ok: true, message: `Connected to ${vendor} using ${model}.`, model };
  }
  return {
    ok: false,
    message: `${vendor} accepted the key, but has no model called "${model}". Available: ${available.slice(0, 5).join(', ')}.`,
    model,
  };
}
