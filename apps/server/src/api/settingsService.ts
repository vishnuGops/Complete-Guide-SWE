import {
  COACH_API_KEY_ENV,
  maskApiKey,
  needsBaseUrl,
  type ConnectionTestResponse,
  type ResetProgressResponse,
  type Settings,
  type SettingsUpdate,
  type SettingsView,
} from '@devpromax/shared';
import { createCoachProvider, type ProviderOptions } from '../coach/index.js';
import { transaction, type Repositories } from '../db/index.js';
import { setJudgeConcurrency } from '../judge/index.js';
import { HttpError } from './errors.js';

/**
 * Settings, the API key, and reset-all-progress (ROADMAP P3-4).
 *
 * The rule this file exists to enforce: the raw coach API key leaves the
 * database in exactly one direction - into a provider request. It is never in a
 * response, never in a log line, and never in an export (CLAUDE.md > Secrets).
 * Everything the UI sees comes through `toView`, which replaces the key with a
 * mask and a note about where the key came from.
 */

export interface SettingsServiceDeps {
  repos: Repositories;
  /** Injected so tests can set `COACH_API_KEY` without touching the process. */
  env?: NodeJS.ProcessEnv;
  /** Injected so the connection test can be driven without a network. */
  provider?: ProviderOptions;
}

export type ApiKeySource = SettingsView['coach']['apiKeySource'];

export interface ResolvedKey {
  key: string | null;
  source: ApiKeySource;
}

/**
 * Where the key comes from, in priority order.
 *
 * The environment wins over the stored value. That is the point of the override
 * (P3-4): someone running DevProMax from a shell that already exports
 * `COACH_API_KEY` expects that key to be used, and silently preferring a stale
 * one typed into Settings months ago would be a very confusing bug to chase.
 */
export function resolveApiKey(
  repos: Repositories,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedKey {
  const fromEnv = env[COACH_API_KEY_ENV]?.trim();
  if (fromEnv) return { key: fromEnv, source: 'env' };

  const stored = repos.settings.get().coach.apiKey?.trim();
  if (stored) return { key: stored, source: 'settings' };

  return { key: null, source: 'none' };
}

/**
 * How to reach the configured provider (ROADMAP P5-11).
 *
 * One function for the connection test and for every coaching turn, because
 * they had drifted in both directions at once. The test passed the stored base
 * URL to *any* provider, so someone who had tried Ollama and switched to
 * Anthropic sent their Anthropic key to `127.0.0.1:11434` and was told the key
 * was wrong. The turns passed it to *none*, so an OpenAI-compatible endpoint
 * configured in Settings tested fine and then every AI Help click went to the
 * default address instead.
 *
 * The stored address applies only to a provider whose address is a setting
 * (`needsBaseUrl`); for the vendors it is a fact, and a leftover value from
 * another provider is exactly that - leftover. Injected options (tests, the
 * end-to-end suite's stand-in vendor) win over both.
 */
export function providerOptionsFor(
  settings: Settings,
  injected: ProviderOptions = {},
): ProviderOptions {
  const stored =
    needsBaseUrl(settings.coach.provider) && settings.coach.baseUrl
      ? { baseUrl: settings.coach.baseUrl }
      : {};
  return { ...stored, ...injected };
}

/** The only shape of settings the API is allowed to send. */
export function toView(settings: Settings, resolved: ResolvedKey): SettingsView {
  const { apiKey: _apiKey, ...coach } = settings.coach;
  return {
    ...settings,
    coach: {
      ...coach,
      apiKeyMasked: maskApiKey(resolved.key),
      apiKeySource: resolved.source,
    },
  };
}

export function readSettings(deps: SettingsServiceDeps): SettingsView {
  return toView(deps.repos.settings.get(), resolveApiKey(deps.repos, deps.env));
}

/**
 * Applies a patch and returns the masked result.
 *
 * An `apiKey` of `""` clears the stored key, which is how the UI offers "remove
 * key" without a second endpoint. Omitting the field leaves the key alone -
 * necessary, because the UI never has the real key to send back.
 */
export function updateSettings(patch: SettingsUpdate, deps: SettingsServiceDeps): SettingsView {
  const normalised: SettingsUpdate = { ...patch };
  if (patch.coach && 'apiKey' in patch.coach) {
    const trimmed = patch.coach.apiKey?.trim() ?? null;
    normalised.coach = { ...patch.coach, apiKey: trimmed === '' ? null : trimmed };
  }

  const next = deps.repos.settings.update(normalised);

  // The judge queue is a live object, not a value read per run, so a concurrency
  // change has to be pushed at it or it takes effect on the next restart.
  if (patch.judge?.concurrency !== undefined) setJudgeConcurrency(next.judge.concurrency);

  return toView(next, resolveApiKey(deps.repos, deps.env));
}

export function resetSettings(deps: SettingsServiceDeps): SettingsView {
  const next = deps.repos.settings.reset();
  setJudgeConcurrency(next.judge.concurrency);
  return toView(next, resolveApiKey(deps.repos, deps.env));
}

/**
 * Checks the configured provider and key.
 *
 * Deliberately refuses rather than guessing when there is no key at all: "no key
 * configured" and "the key is wrong" are different problems with different
 * fixes, and a test that quietly passed with nothing configured would be worse
 * than no test button.
 */
export async function testConnection(deps: SettingsServiceDeps): Promise<ConnectionTestResponse> {
  const settings = deps.repos.settings.get();
  const resolved = resolveApiKey(deps.repos, deps.env);

  if (resolved.key === null) {
    throw new HttpError(
      400,
      'NoApiKey',
      `No API key is configured. Add one in Settings, or set ${COACH_API_KEY_ENV}.`,
    );
  }

  const provider = createCoachProvider(
    settings.coach.provider,
    providerOptionsFor(settings, deps.provider),
  );
  const result = await provider.testConnection({
    apiKey: resolved.key,
    model: settings.coach.model,
  });

  return {
    ok: result.ok,
    provider: settings.coach.provider,
    model: result.model,
    message: result.message,
  };
}

/**
 * Wipes everything the user has done, keeping everything they have written.
 *
 * Submissions, progress, drafts, activity, coach conversations and mock
 * interviews go: they are a record of practice, and "reset all progress" means
 * exactly that - a sitting left behind would be one asking about problems the
 * reset has just marked unsolved again. Notes and
 * settings stay - a note is the user's own writing about a problem, and losing
 * it (along with the API key) to a button labelled "reset progress" would be a
 * nasty surprise. The UI must still confirm before calling this.
 */
export function resetProgress(repos: Repositories): ResetProgressResponse {
  return transaction(repos.db, () => ({
    cleared: {
      submissions: repos.submissions.clear(),
      progress: repos.progress.clear(),
      drafts: repos.drafts.clear(),
      events: repos.events.clear(),
      coachSessions: repos.coach.clearSessions(),
      interviews: repos.interviews.clear(),
    },
  }));
}

/** Applies settings that live outside the database when the server starts. */
export function applyRuntimeSettings(repos: Repositories): void {
  setJudgeConcurrency(repos.settings.get().judge.concurrency);
}
