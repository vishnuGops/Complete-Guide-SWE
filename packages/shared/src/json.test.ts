import { describe, it, expect } from 'vitest';
import { MAX_SAFE_WIRE_INTEGER, findUnsafeInteger, jsonValueSchema } from './json.js';

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

/**
 * The wire's integer range (ROADMAP D22, P2-12).
 *
 * Everything crossing the judge boundary goes through `JSON.parse`, so an
 * integer past 2^53 - 1 is not the integer it was written as. The validator
 * rejects one at authoring time, which is the only point at which it is still
 * a typo rather than a verdict nobody can explain.
 */
describe('findUnsafeInteger', () => {
  it('passes everything a double can hold exactly', () => {
    expect(findUnsafeInteger(0)).toBeNull();
    expect(findUnsafeInteger(MAX_SAFE_WIRE_INTEGER)).toBeNull();
    expect(findUnsafeInteger(-MAX_SAFE_WIRE_INTEGER)).toBeNull();
    expect(findUnsafeInteger([1, [2, { a: 3 }], null, 'four', true])).toBeNull();
  });

  it('leaves fractional numbers alone, because a float is a float', () => {
    // `floatTolerance` exists for these; what is unsafe is a value written as
    // an *integer* that is no longer the integer it was written as.
    expect(findUnsafeInteger(0.1)).toBeNull();
    expect(findUnsafeInteger(-2.5)).toBeNull();
    expect(findUnsafeInteger(1e-9)).toBeNull();
  });

  it('flags a huge integral double, which is the same ambiguity', () => {
    // `1e300` has no fractional part, so two different intended integers near
    // it are the same double - exactly what D22 refuses. A problem that really
    // wants a number that size wants a float, and should say so with a
    // decimal point.
    expect(findUnsafeInteger(1e300)).toMatchObject({ value: 1e300 });
  });

  it('finds the integer that cannot survive, and where it is', () => {
    expect(findUnsafeInteger(MAX_SAFE_WIRE_INTEGER + 2)).toEqual({
      path: '',
      value: MAX_SAFE_WIRE_INTEGER + 2,
    });
    expect(findUnsafeInteger([1, [2, 2 ** 53]])).toMatchObject({ path: '[1][1]' });
    expect(findUnsafeInteger({ a: { b: [2 ** 63] } })).toMatchObject({ path: 'a.b[0]' });
  });

  it('reports the first one it meets, so the message names one place', () => {
    const found = findUnsafeInteger([2 ** 60, 2 ** 61]);
    expect(found).toMatchObject({ path: '[0]' });
  });
});
