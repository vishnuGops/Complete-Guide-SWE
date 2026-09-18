import { z } from 'zod';
import type { CoachProvider } from './coach.js';

/**
 * What a coaching turn costs, and what it is about to cost (ROADMAP P5-6).
 *
 * Two different questions live here and they want different answers:
 *
 *   - **Before the request**, the UI shows an estimate beside the AI Help
 *     button so nobody clicks it without knowing roughly what they are spending.
 *     Nothing has been sent, so this is arithmetic on the text we are about to
 *     send.
 *   - **After the request**, the provider reports what it actually used, and
 *     that is what the spend cap is enforced against. An estimate is not good
 *     enough to stop someone spending money with.
 *
 * Both sides import this, so the number under the button and the number in the
 * cap are computed the same way.
 */

/**
 * Characters per token, for the estimate only.
 *
 * Four is the usual rough ratio for English and code, and it is deliberately
 * not a tokeniser: a real one per vendor would be two dependencies and two
 * answers, to put a "~" number under a button. Every display of this is
 * prefixed with a tilde for that reason.
 */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return estimateTokensFromChars(text.length);
}

/** The same estimate when only the length is to hand, which is the common case. */
export function estimateTokensFromChars(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

export const tokenUsageSchema = z.object({
  inputTokens: z.int().min(0),
  outputTokens: z.int().min(0),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export interface ModelPrice {
  /** USD per million input tokens. */
  inputPerMTok: number;
  /** USD per million output tokens. */
  outputPerMTok: number;
}

/**
 * Published list prices, per million tokens.
 *
 * This table **will go stale**, and the design accounts for that rather than
 * pretending otherwise: an unknown model falls back to the most expensive entry
 * for its provider (`fallbackPrice`), so a price we do not have makes the cap
 * trip *early* rather than late. For a ceiling whose whole job is to stop a
 * surprise bill, erring toward stopping is the only safe direction.
 *
 * Cache reads and writes are not modelled. Caching only ever makes the real
 * bill smaller than this estimate, which is the same safe direction.
 */
export const MODEL_PRICES: Record<CoachProvider, Record<string, ModelPrice>> = {
  anthropic: {
    'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-opus-4-7': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-opus-4-6': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
    'claude-sonnet-4-6': { inputPerMTok: 3, outputPerMTok: 15 },
    'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
    'claude-fable-5-1': { inputPerMTok: 10, outputPerMTok: 50 },
    'claude-fable-5': { inputPerMTok: 10, outputPerMTok: 50 },
  },
  gemini: {
    'gemini-2.5-pro': { inputPerMTok: 1.25, outputPerMTok: 10 },
    'gemini-2.5-flash': { inputPerMTok: 0.3, outputPerMTok: 2.5 },
  },
};

/**
 * The model each provider falls back to when the user has not chosen one.
 *
 * Here rather than in the server's provider files so that pricing and dispatch
 * cannot disagree: a `null` model is not an unknown model, it is a specific
 * one, and charging it at the unknown-model rate would overstate every estimate
 * for the default configuration - which is the one most users never change.
 */
export const COACH_DEFAULT_MODEL: Record<CoachProvider, string> = {
  anthropic: 'claude-opus-5',
  gemini: 'gemini-2.5-pro',
};

/** The dearest entry we know for a provider; what a genuinely unknown model costs. */
export function fallbackPrice(provider: CoachProvider): ModelPrice {
  const known = Object.values(MODEL_PRICES[provider]);
  return known.reduce(
    (dearest, price) =>
      price.inputPerMTok + price.outputPerMTok > dearest.inputPerMTok + dearest.outputPerMTok
        ? price
        : dearest,
    known[0] ?? { inputPerMTok: 0, outputPerMTok: 0 },
  );
}

export function priceFor(provider: CoachProvider, model: string | null): ModelPrice {
  const resolved = model ?? COACH_DEFAULT_MODEL[provider];
  return MODEL_PRICES[provider][resolved] ?? fallbackPrice(provider);
}

export function costUsd(usage: TokenUsage, price: ModelPrice): number {
  return (
    (usage.inputTokens * price.inputPerMTok) / 1_000_000 +
    (usage.outputTokens * price.outputPerMTok) / 1_000_000
  );
}

/**
 * What the response is likely to cost on top of the prompt.
 *
 * The prompt's size is known; the answer's is not. Feedback runs to a few
 * hundred tokens of markdown plus the JSON around it, and output is the dearer
 * side of every price above, so leaving it out would understate the estimate by
 * more than the input contributes.
 */
export const ESTIMATED_OUTPUT_TOKENS = 900;

/** The estimate shown beside the AI Help button, in whole cents-ish precision. */
export function estimateTurnCostUsd(
  provider: CoachProvider,
  model: string | null,
  promptChars: number,
): number {
  return costUsd(
    { inputTokens: estimateTokensFromChars(promptChars), outputTokens: ESTIMATED_OUTPUT_TOKENS },
    priceFor(provider, model),
  );
}

/**
 * How a cost is written in the UI.
 *
 * Sub-cent amounts say "<$0.01" rather than "$0.004": three decimal places of a
 * figure that is already an estimate reads as precision that is not there, and
 * what the user needs to know is "this is nothing" versus "this is real money".
 */
export function formatUsd(amount: number): string {
  if (amount <= 0) return '$0.00';
  if (amount < 0.01) return '<$0.01';
  return `$${amount.toFixed(2)}`;
}
