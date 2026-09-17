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
