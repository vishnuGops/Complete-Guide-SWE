import {
  describeNetworkError,
  describeStatus,
  judgeModel,
  TEST_CONNECTION_TIMEOUT_MS,
  type CoachProvider,
  type ProviderOptions,
} from './provider.js';

/**
 * Google Gemini (ROADMAP D12).
 *
 * Same shape as the Anthropic check: an authenticated model list, which spends
 * nothing and confirms the configured model in the same round trip. Gemini
 * names models `models/<id>`; the prefix is stripped so settings hold the id the
 * user actually typed.
 */
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-pro';

interface ModelsResponse {
  models?: { name?: unknown }[];
}

function stripPrefix(name: string): string {
  return name.startsWith('models/') ? name.slice('models/'.length) : name;
}

export function createGeminiProvider(options: ProviderOptions = {}): CoachProvider {
  const doFetch = options.fetch ?? globalThis.fetch;

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
        response = await doFetch(`${BASE_URL}/models?pageSize=200`, {
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

      let available: string[] = [];
      try {
        const body = (await response.json()) as ModelsResponse;
        available = (body.models ?? [])
          .map((entry) => entry.name)
          .filter((name): name is string => typeof name === 'string')
          .map(stripPrefix);
      } catch {
        available = [];
      }

      return judgeModel('gemini', wanted, available);
    },
  };
}
