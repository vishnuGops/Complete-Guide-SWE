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
  /**
   * Tokens written to the provider's prompt cache, billed above the input rate
   * (ROADMAP P5-9).
   *
   * This is where the entire system prompt is charged on the first turn of a
   * session: `cache_control` covers it, so it arrives as a cache *write* and not
   * as input, and a cost function that only looked at `inputTokens` reported the
   * largest part of the turn as free.
   */
  cacheWriteTokens: z.int().min(0).optional(),
  /** Tokens served from that cache on later turns, billed well below input. */
  cacheReadTokens: z.int().min(0).optional(),
});
export type TokenUsage = z.infer<typeof tokenUsageSchema>;

export interface ModelPrice {
  /** USD per million input tokens. */
  inputPerMTok: number;
  /** USD per million output tokens. */
  outputPerMTok: number;
  /**
   * USD per million tokens read from the prompt cache, when the vendor prices
   * it as something other than `CACHE_READ_MULTIPLIER` times input.
   *
   * Optional because it almost never is: one pair of multipliers covers the
   * table. `claude-opus-5-5` is the exception - its cache reads are a twentieth
   * of input, not a tenth - and a multiplier that overstated them would make
   * the cap trip early on exactly the long conversations caching is for.
   */
  cacheReadPerMTok?: number;
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
 * Cache reads and writes are modelled as multiples of the input rate (see
 * `CACHE_WRITE_MULTIPLIER`), because the first correction to the older claim
 * here - that caching only ever makes the bill smaller - is that a cache
 * *write* costs more than plain input. A session's first turn writes the whole
 * system prompt into the cache and is dearer than an uncached one; every turn
 * after it is much cheaper. Only the second half of that was being counted.
 */
export const MODEL_PRICES: Record<CoachProvider, Record<string, ModelPrice>> = {
  anthropic: {
    'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
    'claude-opus-5-5': { inputPerMTok: 4, outputPerMTok: 20, cacheReadPerMTok: 0.2 },
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
  /*
   * Deliberately empty (ROADMAP P9-4).
   *
   * The endpoint is the user's own: a model running on their laptop costs
   * nothing, and a hosted gateway costs whatever its owner charges. Any number
   * here would be a guess presented as a fact, and the two guesses are wrong in
   * opposite directions. So a turn through this provider is priced at zero, the
   * spend cap has nothing to police, and Settings says so rather than showing a
   * confident `$0.00` next to AI Help.
   */
  'openai-compatible': {},
};

/** Whether a provider's rates are knowable at all (P9-4). */
export function hasKnownPricing(provider: CoachProvider): boolean {
  return Object.keys(MODEL_PRICES[provider]).length > 0;
}

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
  // Ollama's naming, because it is the endpoint most people have running. A
  // user with something else types its name; the connection test then says
  // whether the endpoint has heard of it.
  'openai-compatible': 'qwen2.5-coder:14b',
};

/** The dearest entry we know for a provider; what a genuinely unknown model costs. */
export function fallbackPrice(provider: CoachProvider): ModelPrice {
  const known = Object.values(MODEL_PRICES[provider]);
  // An empty table is not "we have not looked it up", it is "it cannot be
  // known" - see `openai-compatible` above.
  if (known.length === 0) return { inputPerMTok: 0, outputPerMTok: 0 };
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

/**
 * Cache write and read rates, as multiples of the input rate.
 *
 * Both vendors price cache traffic this way rather than per model, so one pair
 * of multipliers covers the table above and does not go stale when a model is
 * added to it.
 */
export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER = 0.1;

export function costUsd(usage: TokenUsage, price: ModelPrice): number {
  const inputRate = price.inputPerMTok / 1_000_000;
  const cacheReadRate =
    price.cacheReadPerMTok === undefined
      ? inputRate * CACHE_READ_MULTIPLIER
      : price.cacheReadPerMTok / 1_000_000;
  return (
    usage.inputTokens * inputRate +
    (usage.cacheWriteTokens ?? 0) * inputRate * CACHE_WRITE_MULTIPLIER +
    (usage.cacheReadTokens ?? 0) * cacheReadRate +
    (usage.outputTokens * price.outputPerMTok) / 1_000_000
  );
}

/**
 * What an Anthropic model accepts beyond the basics (ROADMAP P5-11).
 *
 * Here beside the price table rather than in the server's adapter, for the
 * reason `COACH_DEFAULT_MODEL` is: the estimate under the AI Help button has to
 * know whether the model will think, and the adapter has to know whether it may
 * ask it to. Two copies of that fact would disagree the first time a model is
 * added to one of them.
 *
 * Adaptive thinking and `effort` arrived together with Opus and Sonnet 4.6, and
 * every model since takes them - and *only* adaptive thinking, not a token
 * budget. Haiku 4.5 and everything older answer a request carrying either with
 * a 400, which on the first real key is the whole feature failing.
 */
export interface AnthropicCapabilities {
  /** `thinking: {type: 'adaptive'}` and `output_config.effort` are accepted. */
  adaptiveThinking: boolean;
}

/**
 * Read off the model id rather than listed per model, so a model released
 * after this table was written gets the modern request without an edit.
 *
 * The one direction it errs in on purpose: an id it cannot read is treated as
 * *not* thinking. A request without thinking is accepted by every model and is
 * merely a less careful review; a request with it is refused outright by every
 * model that predates it.
 */
export function anthropicCapabilities(model: string): AnthropicCapabilities {
  const match = /^claude-(opus|sonnet|haiku|fable)-(\d+)(?:-(\d{1,2}))?(?:-|$)/.exec(model);
  if (!match) return { adaptiveThinking: false };

  const family = match[1];
  const major = Number(match[2]);
  const minor = match[3] === undefined ? 0 : Number(match[3]);

  // No Haiku takes adaptive thinking yet; the first that does will need this
  // line, and until then the cost of being wrong is a less careful answer.
  if (family === 'haiku') return { adaptiveThinking: false };
  return { adaptiveThinking: major > 4 || (major === 4 && minor >= 6) };
}

/**
 * Whether a turn on this model spends tokens thinking before it answers.
 *
 * Anthropic's thinking models are asked to (adaptive, at an effort level);
 * Gemini's 2.5 series thinks by default and bills it as output. An
 * OpenAI-compatible endpoint might or might not, and is priced at zero either
 * way (P9-4), so the answer there changes nothing.
 */
export function modelThinks(provider: CoachProvider, model: string | null): boolean {
  const resolved = model ?? COACH_DEFAULT_MODEL[provider];
  if (provider === 'anthropic') return anthropicCapabilities(resolved).adaptiveThinking;
  if (provider === 'gemini') return true;
  return false;
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

/**
 * What a review spends thinking before it writes a word (ROADMAP P5-13).
 *
 * Billed as output, invisible in the answer, and the larger half of a turn on
 * any model that thinks: scoring five dimensions at medium effort runs to a few
 * thousand tokens of reasoning for a few hundred of prose. An estimate built on
 * the prose alone put a number under the button that the first real bill was
 * several times over, which is the one thing an estimate is for not doing.
 */
export const ESTIMATED_THINKING_TOKENS = 3_000;

/**
 * The sizes the coach's context is cut to (P5-2), shared so that the estimate
 * beside AI Help and the context the server builds cannot drift apart (P5-13).
 * They were two copies, one in each app, until the audit found the client's
 * figure for the system prompt a third short of the real one.
 */
export const COACH_STATEMENT_CAP = 8_000;
export const COACH_EDITORIAL_CAP = 4_000;
/** Prior attempts are summaries already; this bounds how many, not how long. */
export const COACH_MAX_PRIOR_ATTEMPTS = 3;
/**
 * The rubric system prompt's length, give or take. The client does not have
 * the prompt - it is read from disk on the server - and a round trip for a
 * figure that is approximate by construction is not worth it; a server test
 * fails when the real prompt drifts more than a tenth away from this.
 */
export const COACH_SYSTEM_PROMPT_CHARS = 9_200;

/** The output side of the estimate: the answer, and the thinking when there is any. */
export function estimatedOutputTokens(provider: CoachProvider, model: string | null): number {
  return ESTIMATED_OUTPUT_TOKENS + (modelThinks(provider, model) ? ESTIMATED_THINKING_TOKENS : 0);
}

/** The estimate shown beside the AI Help button, in whole cents-ish precision. */
export function estimateTurnCostUsd(
  provider: CoachProvider,
  model: string | null,
  promptChars: number,
): number {
  return costUsd(
    {
      inputTokens: estimateTokensFromChars(promptChars),
      outputTokens: estimatedOutputTokens(provider, model),
    },
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

/**
 * What a turn whose cost the vendor never reported is charged at (ROADMAP P5-9).
 *
 * A turn can end without a usage report: a mid-stream timeout, a dropped
 * connection, a vendor that simply did not say. Its row carries a NULL cost,
 * and summing those as zero made the spend cap ignore exactly the turns that
 * went wrong - so a session could fail expensively, over and over, for free.
 *
 * Charged instead at the dearest model known for the provider, over a prompt
 * the size of a full context window's worth of coaching. That is deliberately
 * pessimistic: the cap's whole job is to stop a surprise bill, and the two ways
 * to be wrong are "stop slightly early" and "do not stop".
 */
export const UNREPORTED_TURN_TOKENS: TokenUsage = {
  inputTokens: 30_000,
  // With the thinking allowance, because the dearest model thinks: a turn
  // that died before reporting most likely died mid-think (P5-13).
  outputTokens: ESTIMATED_OUTPUT_TOKENS + ESTIMATED_THINKING_TOKENS,
};

export function unreportedTurnCostUsd(provider: CoachProvider): number {
  return costUsd(UNREPORTED_TURN_TOKENS, fallbackPrice(provider));
}
