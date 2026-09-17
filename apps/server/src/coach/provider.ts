import { COACH_PROVIDER_LABEL, type CoachProvider as CoachProviderId } from '@devpromax/shared';

/**
 * The provider seam (ROADMAP D12).
 *
 * Nothing outside this folder may know which vendor is configured: routes and
 * services talk to a `CoachProvider`, and swapping Anthropic for Gemini is a
 * settings change rather than a code change.
 *
 * Only `testConnection` exists so far, because that is all P3-4's Settings
 * screen needs - "is this key any good, and does this model exist". The
 * `stream()` half of the interface arrives with P5-1, which also decides whether
 * the streaming path is worth taking each vendor's official SDK as a dependency.
 * A key check is one authenticated GET, and an SDK per provider to make it would
 * be a dependency bought for the wrong reason - so this is `fetch`, injectable,
 * and the tests never touch the network.
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

export interface CoachProvider {
  readonly id: CoachProviderId;
  /** Used when the user has not picked a model. */
  readonly defaultModel: string;
  testConnection(options: TestConnectionOptions): Promise<ConnectionResult>;
}

export type FetchLike = typeof fetch;

export interface ProviderOptions {
  /** Swapped out in tests; there is no network in CI (ROADMAP P5-7). */
  fetch?: FetchLike;
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
