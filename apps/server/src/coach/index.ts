import type { CoachProvider as CoachProviderId } from '@devpromax/shared';
import { createAnthropicProvider } from './anthropic.js';
import { createGeminiProvider } from './gemini.js';
import type { CoachProvider, ProviderOptions } from './provider.js';

export * from './provider.js';
export { ANTHROPIC_DEFAULT_MODEL, createAnthropicProvider } from './anthropic.js';
export { GEMINI_DEFAULT_MODEL, createGeminiProvider } from './gemini.js';
export {
  coachFeedbackJsonSchema,
  parseFeedback,
  streamCoachFeedback,
  type CoachStreamEvent,
  type FeedbackStreamOptions,
} from './feedback.js';
export {
  buildContext,
  CONTEXT_BUDGET_CHARS,
  type AttemptMemory,
  type ContextInput,
} from './context.js';
export { PROMPT_VERSION, systemPrompt } from './prompts/index.js';

/** The one place a provider id becomes an implementation. */
export function createCoachProvider(
  id: CoachProviderId,
  options: ProviderOptions = {},
): CoachProvider {
  return id === 'anthropic' ? createAnthropicProvider(options) : createGeminiProvider(options);
}
