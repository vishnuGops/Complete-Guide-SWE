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
  /**
   * Cache the conversation up to and including this turn (ROADMAP P5-13).
   *
   * Set by the caller on the last turn of *history* - never on the new message,
   * which is the one part guaranteed to differ next time. A follow-up resends
   * the whole window every turn, and without this only the system prompt was
   * cached, so the review being discussed was paid for at the full input rate
   * on every question about it. Vendors without explicit caching ignore it.
   */
  cacheBreakpoint?: boolean;
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
  /**
   * A second, uncached system block for this kind of turn (ROADMAP P5-12).
   *
   * A follow-up question is answered under the same rubric prompt as the
   * review - the hint ladder and the solution gate still hold - but that prompt
   * ends "return JSON matching the required schema", and a prose turn has no
   * schema. This is where the turn says so. Separate from `system` rather than
   * appended to it, because `system` is the cached prefix and a different
   * suffix on it would be a different prefix.
   */
  instructions?: string;
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
  /**
   * Where the vendor lives, if not where it normally lives.
   *
   * Two callers need this. The end-to-end suite (P5-8) types a fake key into
   * Settings and presses "Test connection", and that has to fail without a
   * packet leaving the machine - so it points this at the local server, which
   * answers every unknown path with a 403 and produces an honest "the key was
   * rejected" on screen. The other is anyone running the vendor behind their own
   * gateway. Unset in production, where the SDK's own default applies.
   */
  baseUrl?: string;
  /**
   * How long an open stream may go without a byte before it is abandoned
   * (ROADMAP P5-11). The adapter's own default in production; shortened in
   * tests, which cannot wait ninety seconds to watch a hang be noticed.
   */
  streamIdleMs?: number;
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

/**
 * A 404 on the messages endpoint (ROADMAP P5-11).
 *
 * The endpoint exists - the key check reached it - so what the vendor did not
 * find is the model. "Does not recognise that endpoint, the key may be for a
 * different product" sent someone with a typo in the model name off to replace
 * a perfectly good key.
 */
export function describeUnknownModel(id: CoachProviderId, model: string): string {
  return `${COACH_PROVIDER_LABEL[id]} has no model called "${model}". Check the model name in Settings, or clear it to use the default.`;
}

/** Past this, a vendor's explanation is a paragraph nobody reads in a panel. */
const VENDOR_MESSAGE_CAP = 300;

/**
 * A 400, with the vendor's own explanation attached (ROADMAP P5-11).
 *
 * The one status where `describeStatus`'s rule - never forward the vendor's
 * wording - does more harm than good. A 400 means the request itself was
 * wrong, only the vendor knows which part, and "refused the request (HTTP
 * 400)" left the only person able to act on it with nothing to act on. So the
 * message comes through, trimmed to a sentence or two and with the key
 * scrubbed out of it: a vendor echoing a header back in an error is rare, and
 * this app's rule about the key does not depend on how rare.
 */
export function describeRefusedRequest(
  id: CoachProviderId,
  vendorMessage: string | null,
  apiKey: string,
): string {
  const vendor = COACH_PROVIDER_LABEL[id];
  const cleaned = (vendorMessage ?? '').replace(/\s+/g, ' ').trim();
  if (cleaned === '') return describeStatus(id, 400);

  const scrubbed = apiKey === '' ? cleaned : cleaned.split(apiKey).join('[key]');
  const trimmed =
    scrubbed.length > VENDOR_MESSAGE_CAP ? `${scrubbed.slice(0, VENDOR_MESSAGE_CAP)}…` : scrubbed;
  return `${vendor} refused the request: ${trimmed}`;
}

export function describeNetworkError(id: CoachProviderId, error: unknown): string {
  const vendor = COACH_PROVIDER_LABEL[id];
  // `AbortSignal.timeout` rejects with a `TimeoutError`, not an `AbortError`
  // (ROADMAP P5-9): a request that ran out of time was being reported as "check
  // that this machine is online", which sends the user to look at their wifi
  // while the vendor is merely slow.
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return `${vendor} did not answer in time.`;
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
  available: readonly string[] | null,
): ConnectionResult {
  const vendor = COACH_PROVIDER_LABEL[id];

  /*
   * `null` means the answer was not a model list at all (ROADMAP P5-10).
   *
   * Found by an end-to-end test pointed at a stand-in vendor: the response was
   * an HTML page, the SDK parsed it into an object with no `data`, the model
   * list came out empty - and an empty list used to be read as "connected, but
   * we could not check the model". So a proxy, a captive portal or a mistyped
   * base URL all reported a working key. An unreadable answer is not a
   * successful connection.
   */
  if (available === null) {
    return {
      ok: false,
      message: `${vendor} answered, but not with a model list. Check the network between here and the vendor.`,
      model,
    };
  }

  // The empty case is unreachable through either adapter - both map an empty
  // list to `null` above, since neither vendor answers with no models for a
  // valid key - and is kept as the harmless reading of "connected, model
  // unverified" for any future provider that legitimately can.
  if (available.length === 0 || available.includes(model)) {
    return { ok: true, message: `Connected to ${vendor} using ${model}.`, model };
  }
  return {
    ok: false,
    message: `${vendor} accepted the key, but has no model called "${model}". Available: ${available.slice(0, 5).join(', ')}.`,
    model,
  };
}
