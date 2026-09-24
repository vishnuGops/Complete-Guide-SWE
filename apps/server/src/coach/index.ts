import type { CoachProvider as CoachProviderId } from '@devpromax/shared';
import { createAnthropicProvider } from './anthropic.js';
import { createGeminiProvider } from './gemini.js';
import { createOpenAiCompatibleProvider } from './openaiCompatible.js';
import type { CoachProvider, ProviderOptions } from './provider.js';

/*
 * The coach's surface for the rest of the server: what the services import.
 * Tests reach the individual modules directly.
 */
export * from './provider.js';
export { streamCoachFeedback } from './feedback.js';
export { buildContext, type AttemptMemory, type SubmissionSummary } from './context.js';
export { followUpPrompt, interviewerPrompt, systemPrompt } from './prompts/index.js';
export { describeDelta, diffCode } from './codeDelta.js';
export { precheck } from './precheck.js';

/**
 * Where the vendor lives, when it is not where it normally lives.
 *
 * Read here rather than in `config.ts` so that both providers get it from one
 * place and neither has to know an environment variable exists. Set by the
 * end-to-end suite, which needs a "Test connection" that fails without leaving
 * the machine (ROADMAP P5-8); unset in normal use.
 */
const COACH_BASE_URL_ENV = 'DEVPROMAX_COACH_BASE_URL';

/** The one place a provider id becomes an implementation. */
export function createCoachProvider(
  id: CoachProviderId,
  options: ProviderOptions = {},
): CoachProvider {
  const fromEnv = process.env[COACH_BASE_URL_ENV]?.trim();
  const resolved: ProviderOptions =
    options.baseUrl === undefined && fromEnv ? { ...options, baseUrl: fromEnv } : options;

  if (id === 'anthropic') return createAnthropicProvider(resolved);
  if (id === 'gemini') return createGeminiProvider(resolved);
  return createOpenAiCompatibleProvider(resolved);
}
