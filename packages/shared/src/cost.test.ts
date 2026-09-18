import { describe, expect, it } from 'vitest';
import {
  costUsd,
  estimateTokens,
  estimateTurnCostUsd,
  fallbackPrice,
  formatUsd,
  MODEL_PRICES,
  priceFor,
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
