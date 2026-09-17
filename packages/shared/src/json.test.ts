import { describe, it, expect } from 'vitest';
import { jsonValueSchema } from './json.js';

describe('jsonValueSchema', () => {
  it.each([
    ['string', 'hi'],
    ['zero', 0],
    ['negative zero', -0],
    ['large safe integer', Number.MAX_SAFE_INTEGER],
    ['boolean', true],
    ['null', null],
    ['empty array', []],
    ['empty object', {}],
    ['nested', { a: [1, [2, { b: null }]], c: 'x' }],
  ])('accepts %s', (_label, value) => {
    expect(jsonValueSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('rejects %s, which has no JSON representation', (_label, value) => {
    expect(jsonValueSchema.safeParse(value).success).toBe(false);
  });

  it('rejects undefined and non-JSON types', () => {
    expect(jsonValueSchema.safeParse(undefined).success).toBe(false);
    expect(jsonValueSchema.safeParse(() => 1).success).toBe(false);
    expect(jsonValueSchema.safeParse(new Date()).success).toBe(false);
    expect(jsonValueSchema.safeParse(1n).success).toBe(false);
  });

  it('rejects a non-finite number nested deep inside a structure', () => {
    expect(
      jsonValueSchema.safeParse({
        rows: [
          [1, 2],
          [3, Number.NaN],
        ],
      }).success,
    ).toBe(false);
  });

  it('preserves -0 through a round trip, since it matters to floatTolerance', () => {
    const parsed = jsonValueSchema.parse(-0);
    expect(Object.is(parsed, -0)).toBe(true);
  });
});
