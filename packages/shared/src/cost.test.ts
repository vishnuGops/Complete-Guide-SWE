import { describe, expect, it } from 'vitest';
import {
  anthropicCapabilities,
  costUsd,
  ESTIMATED_OUTPUT_TOKENS,
  ESTIMATED_THINKING_TOKENS,
  estimatedOutputTokens,
  estimateTokens,
  estimateTurnCostUsd,
  fallbackPrice,
  formatUsd,
  MODEL_PRICES,
  priceFor,
  UNREPORTED_TURN_TOKENS,
  unreportedTurnCostUsd,
} from './cost.js';

/**
 * The cost model (ROADMAP P5-6).
 *
 * The property that matters most is not accuracy - this is an estimate against
 * a table that will go stale - but *direction*. A cap whose job is to stop a
 * surprise bill has to fail toward stopping, so an unknown model must never be
 * priced lower than a known one.
 */

describe('priceFor', () => {
  it('uses the published price for a model it knows', () => {
    expect(priceFor('anthropic', 'claude-opus-5')).toEqual({ inputPerMTok: 5, outputPerMTok: 25 });
  });

  it('charges an unknown model at the dearest rate it knows', () => {
    // The safe direction: a price we do not have trips the cap early.
    const unknown = priceFor('anthropic', 'claude-something-unreleased');
    const dearest = fallbackPrice('anthropic');

    expect(unknown).toEqual(dearest);
    for (const known of Object.values(MODEL_PRICES.anthropic)) {
      expect(unknown.inputPerMTok + unknown.outputPerMTok).toBeGreaterThanOrEqual(
        known.inputPerMTok + known.outputPerMTok,
      );
    }
  });

  it('treats "no model chosen" as unknown rather than as free', () => {
    expect(priceFor('gemini', null)).toEqual(fallbackPrice('gemini'));
    expect(priceFor('gemini', null).outputPerMTok).toBeGreaterThan(0);
  });

  it('keeps the two provider tables apart', () => {
    expect(priceFor('gemini', 'claude-opus-5')).toEqual(fallbackPrice('gemini'));
  });
});

describe('costUsd', () => {
  it('prices input and output at their separate rates', () => {
    const cost = costUsd(
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      { inputPerMTok: 5, outputPerMTok: 25 },
    );
    expect(cost).toBeCloseTo(30);
  });

  it('is zero for a turn that used nothing', () => {
    expect(costUsd({ inputTokens: 0, outputTokens: 0 }, priceFor('anthropic', null))).toBe(0);
  });
});

describe('estimateTokens', () => {
  it('rounds up, so an estimate is never under by a partial token', () => {
    expect(estimateTokens('abc')).toBe(1);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});

describe('estimateTurnCostUsd', () => {
  it('counts the answer as well as the prompt', () => {
    // Output is the dearer side of every price in the table, so leaving it out
    // would understate a short prompt's turn by more than the input costs.
    const withPrompt = estimateTurnCostUsd('anthropic', 'claude-opus-5', 0);
    expect(withPrompt).toBeGreaterThan(0);
  });

  it('grows with the prompt', () => {
    const small = estimateTurnCostUsd('anthropic', 'claude-opus-5', 1_000);
    const large = estimateTurnCostUsd('anthropic', 'claude-opus-5', 100_000);
    expect(large).toBeGreaterThan(small);
  });
});

describe('formatUsd', () => {
  it('says "nothing" rather than three decimal places of an estimate', () => {
    expect(formatUsd(0.004)).toBe('<$0.01');
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('shows real money as money', () => {
    expect(formatUsd(0.42)).toBe('$0.42');
    expect(formatUsd(3)).toBe('$3.00');
  });
});

describe('cache tokens', () => {
  const price = { inputPerMTok: 10, outputPerMTok: 0 };

  it('charges a cache write above the input rate', () => {
    // The correction P5-9 made: the first turn of a session writes the whole
    // system prompt into the cache, and a write costs *more* than plain input.
    // Counting only `inputTokens` reported the dearest turn as the cheapest.
    const write = costUsd({ inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000_000 }, price);
    const plain = costUsd({ inputTokens: 1_000_000, outputTokens: 0 }, price);

    expect(write).toBeCloseTo(12.5);
    expect(write).toBeGreaterThan(plain);
  });

  it('charges a cache read far below it', () => {
    const read = costUsd({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 }, price);
    expect(read).toBeCloseTo(1);
  });

  it('is unchanged for usage that reports no cache traffic', () => {
    expect(costUsd({ inputTokens: 1_000_000, outputTokens: 0 }, price)).toBeCloseTo(10);
  });
});

describe('unreportedTurnCostUsd', () => {
  it('prices a turn nobody could price at the dearest known rate', () => {
    const anthropic = unreportedTurnCostUsd('anthropic');
    const dearest = costUsd(UNREPORTED_TURN_TOKENS, fallbackPrice('anthropic'));

    expect(anthropic).toBeCloseTo(dearest);
    // The direction that matters: charging such a turn at zero let a
    // conversation that kept failing expensively never reach its cap.
    expect(anthropic).toBeGreaterThan(0);
  });

  it('is at least as dear as a turn on the default model', () => {
    const onDefault = costUsd(UNREPORTED_TURN_TOKENS, priceFor('anthropic', null));
    expect(unreportedTurnCostUsd('anthropic')).toBeGreaterThanOrEqual(onDefault);
  });
});

describe('claude-opus-5-5 (P5-11)', () => {
  it('is priced from the table, not at the unknown-model fallback', () => {
    // It used to fall through to Fable's $10/$50: double the real rate, and a
    // cap that tripped at half the spend it was set for.
    expect(priceFor('anthropic', 'claude-opus-5-5')).toMatchObject({
      inputPerMTok: 4,
      outputPerMTok: 20,
    });
  });

  it('charges its cache reads at their own rate, not a tenth of input', () => {
    const read = costUsd(
      { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000 },
      priceFor('anthropic', 'claude-opus-5-5'),
    );
    expect(read).toBeCloseTo(0.2);
  });
});

describe('anthropicCapabilities (P5-11)', () => {
  it('gives adaptive thinking to every model since Opus and Sonnet 4.6', () => {
    for (const model of [
      'claude-opus-5',
      'claude-opus-5-5',
      'claude-sonnet-5',
      'claude-fable-5-1',
      'claude-opus-4-7',
      'claude-sonnet-4-6',
    ]) {
      expect(anthropicCapabilities(model).adaptiveThinking, model).toBe(true);
    }
  });

  it('withholds it from Haiku 4.5 and everything older, which answer it with a 400', () => {
    for (const model of [
      'claude-haiku-4-5',
      'claude-haiku-4-5-20251001',
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-20250514',
      'claude-3-5-sonnet-20241022',
    ]) {
      expect(anthropicCapabilities(model).adaptiveThinking, model).toBe(false);
    }
  });

  it('errs toward the request every model accepts when the id is unreadable', () => {
    expect(anthropicCapabilities('my-proxy-alias').adaptiveThinking).toBe(false);
  });
});

describe('the estimate accounts for thinking (P5-13)', () => {
  it('adds the thinking allowance on a model that thinks', () => {
    expect(estimatedOutputTokens('anthropic', 'claude-opus-5')).toBe(
      ESTIMATED_OUTPUT_TOKENS + ESTIMATED_THINKING_TOKENS,
    );
    // The default configuration is the one most people see.
    expect(estimatedOutputTokens('anthropic', null)).toBe(
      ESTIMATED_OUTPUT_TOKENS + ESTIMATED_THINKING_TOKENS,
    );
    expect(estimatedOutputTokens('gemini', null)).toBe(
      ESTIMATED_OUTPUT_TOKENS + ESTIMATED_THINKING_TOKENS,
    );
  });

  it('does not on one that does not', () => {
    expect(estimatedOutputTokens('anthropic', 'claude-haiku-4-5')).toBe(ESTIMATED_OUTPUT_TOKENS);
  });

  it('prices the button at what a review with thinking really costs', () => {
    // Output alone, on Opus 5: 3,900 tokens at $25/MTok. The old figure priced
    // 900 of them, a quarter of the bill the first real turn produced.
    expect(estimateTurnCostUsd('anthropic', 'claude-opus-5', 0)).toBeCloseTo(
      ((ESTIMATED_OUTPUT_TOKENS + ESTIMATED_THINKING_TOKENS) * 25) / 1_000_000,
    );
  });
});
