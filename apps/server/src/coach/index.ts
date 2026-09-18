import type { CoachProvider as CoachProviderId } from '@devpromax/shared';
import { createAnthropicProvider } from './anthropic.js';
import { createGeminiProvider } from './gemini.js';
import { createOpenAiCompatibleProvider } from './openaiCompatible.js';
import type { CoachProvider, ProviderOptions } from './provider.js';

export * from './provider.js';
export { ANTHROPIC_DEFAULT_MODEL, createAnthropicProvider } from './anthropic.js';
export { GEMINI_DEFAULT_MODEL, createGeminiProvider } from './gemini.js';
export {
  OPENAI_COMPATIBLE_DEFAULT_MODEL,
  createOpenAiCompatibleProvider,
} from './openaiCompatible.js';
export {
  coachFeedbackJsonSchema,
  parseFeedback,
  streamCoachFeedback,
  type FeedbackChunk,
  type FeedbackStreamOptions,
} from './feedback.js';
export {
  buildContext,
  CONTEXT_BUDGET_CHARS,
  type AttemptMemory,
  type ContextInput,
} from './context.js';
export { PROMPT_VERSION, interviewerPrompt, systemPrompt } from './prompts/index.js';
export { describeDelta, diffCode, type CodeDelta } from './codeDelta.js';
export {
  hasMeaningfulBody,
  isUnchangedStarter,
  normalise,
  precheck,
  type PrecheckInput,
  type PrecheckResult,
} from './precheck.js';

/**
 * Where the vendor lives, when it is not where it normally lives.
 *
 * Read here rather than in `config.ts` so that both providers get it from one
 * place and neither has to know an environment variable exists. Set by the
 * end-to-end suite, which needs a "Test connection" that fails without leaving
 * the machine (ROADMAP P5-8); unset in normal use.
 */
export const COACH_BASE_URL_ENV = 'DEVPROMAX_COACH_BASE_URL';

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
