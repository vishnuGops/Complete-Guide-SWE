import { z } from 'zod';

/**
 * The wire format for every test input and output.
 *
 * Problem packages are hand-authored JSON, the judge hands values to a Python or
 * Java harness as JSON, and the UI renders them. Restricting the domain to plain
 * JSON keeps those three sides honest: anything a harness cannot serialise
 * cannot be expressed in `tests.json` either.
 */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    // NaN and Infinity have no JSON representation, so reject them at the edge
    // rather than letting them become `null` inside a harness.
    z.number().refine(Number.isFinite, { message: 'must be a finite number' }),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

/**
 * The widest integer that survives the round trip (ROADMAP D22).
 *
 * Every value on the wire goes through `JSON.parse`, so an integer larger than
 * 2^53 - 1 is already a lie by the time anything compares it: two different
 * 64-bit answers that round to the same double compare *equal*, and a
 * Node-stringified 2^63 makes Java's reader throw. The bound is enforced in the
 * validator, so a problem that needs bigger numbers is rejected at authoring
 * time rather than judged wrongly at run time.
 *
 * No planned problem needs full 64-bit answers; sums to 10^18 are phrased
 * modulo 10^9+7, as interview problems usually are.
 */
export const MAX_SAFE_WIRE_INTEGER = Number.MAX_SAFE_INTEGER;

/**
 * The first number in a value that cannot survive the round trip, with the path
 * to it - or `null` when every number is safe.
 *
 * Non-integral numbers are left alone: a float is a float, and
 * `floatTolerance` exists for exactly that. What this catches is an *integer*
 * so large that it is no longer the integer it was written as.
 */
export function findUnsafeInteger(
  value: JsonValue,
  path = '',
): { path: string; value: number } | null {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) return null;
    return Number.isSafeInteger(value) ? null : { path, value };
  }

  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      const found = findUnsafeInteger(entry, `${path}[${String(index)}]`);
      if (found) return found;
    }
    return null;
  }

  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      const found = findUnsafeInteger(entry, path === '' ? key : `${path}.${key}`);
      if (found) return found;
    }
  }

  return null;
}
