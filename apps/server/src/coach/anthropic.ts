import {
  describeNetworkError,
  describeStatus,
  judgeModel,
  TEST_CONNECTION_TIMEOUT_MS,
  type CoachProvider,
  type ProviderOptions,
} from './provider.js';

/**
 * Anthropic (ROADMAP D12).
 *
 * The key check is `GET /v1/models`: it is authenticated, it spends no tokens,
 * and it returns the model list, so one request answers both "is this key
 * valid" and "does the configured model exist".
 */
const BASE_URL = 'https://api.anthropic.com/v1';

/** Required on every Anthropic request; the API is versioned by header, not path. */
const API_VERSION = '2023-06-01';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5';

interface ModelsResponse {
  data?: { id?: unknown }[];
}

export function createAnthropicProvider(options: ProviderOptions = {}): CoachProvider {
  const doFetch = options.fetch ?? globalThis.fetch;

  return {
    id: 'anthropic',
    defaultModel: ANTHROPIC_DEFAULT_MODEL,

    async testConnection({ apiKey, model, signal }) {
      const wanted = model ?? ANTHROPIC_DEFAULT_MODEL;
      const timeout = AbortSignal.timeout(TEST_CONNECTION_TIMEOUT_MS);

      let response: Response;
      try {
        response = await doFetch(`${BASE_URL}/models?limit=100`, {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': API_VERSION,
          },
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        return { ok: false, message: describeNetworkError('anthropic', error), model: wanted };
      }

      if (!response.ok) {
        return { ok: false, message: describeStatus('anthropic', response.status), model: wanted };
      }

      // A 200 already proves the key works. A body we cannot read only costs us
      // the model check, so it is not worth failing the whole test over.
      let available: string[] = [];
      try {
        const body = (await response.json()) as ModelsResponse;
        available = (body.data ?? [])
          .map((entry) => entry.id)
          .filter((id): id is string => typeof id === 'string');
      } catch {
        available = [];
      }

      return judgeModel('anthropic', wanted, available);
    },
  };
}
