import { z } from 'zod';
import { MAX_CODE_BYTES } from './judge.js';
import { languageSchema, type Language } from './language.js';

/**
 * Formatting a solution (ROADMAP P9-5).
 *
 * One formatter per language, each the one that language's community treats as
 * the default: `black` for Python, and `google-java-format` in its AOSP style
 * for Java, because AOSP is the four-space indent every Java starter in the
 * catalogue already uses. Neither ships with the app. Both are optional, found
 * on the machine the first time something asks, and a formatter that is not
 * there makes the feature absent rather than broken.
 */
export const FORMATTER_NAMES = ['black', 'google-java-format'] as const;
export const formatterNameSchema = z.enum(FORMATTER_NAMES);
export type FormatterName = z.infer<typeof formatterNameSchema>;

export const FORMATTER_FOR: Record<Language, FormatterName> = {
  python: 'black',
  java: 'google-java-format',
};

/**
 * Whether one formatter was found, and how (`GET /api/format`).
 *
 * The same pairing as a runtime check (P8-3): when it is missing, `guidance` is
 * the sentence that fixes it rather than a restatement of the problem.
 */
export const formatterStatusSchema = z.object({
  language: languageSchema,
  name: formatterNameSchema,
  available: z.boolean(),
  /** As the formatter reported it - "26.5.1" - or null when none was found. */
  version: z.string().nullable(),
  /** What is (or would be) run, including a `DEVPROMAX_*` override. */
  command: z.string(),
  guidance: z.string().nullable(),
});
export type FormatterStatus = z.infer<typeof formatterStatusSchema>;

export const formattersResponseSchema = z.object({
  formatters: z.array(formatterStatusSchema),
});
export type FormattersResponse = z.infer<typeof formattersResponseSchema>;

/** `POST /api/format`. */
export const formatRequestSchema = z.object({
  language: languageSchema,
  code: z.string().max(MAX_CODE_BYTES),
});
export type FormatRequest = z.infer<typeof formatRequestSchema>;

/**
 * What came back.
 *
 * Three outcomes rather than an error status for the last two, because neither
 * is a failure of the request: code that does not parse is the ordinary state
 * of code being written, and a formatter that is not installed is a fact about
 * the machine. Both are things to tell the user, not things to retry.
 */
export const formatResponseSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('formatted'),
    code: z.string(),
    /** False when the code was already formatted. */
    changed: z.boolean(),
  }),
  z.object({
    outcome: z.literal('invalid'),
    /** The formatter's own complaint, with the plumbing taken out of it. */
    message: z.string(),
    /** Where it complained, when it said: the editor puts the caret there. */
    line: z.int().positive().optional(),
    column: z.int().nonnegative().optional(),
  }),
  z.object({
    outcome: z.literal('unavailable'),
    message: z.string(),
  }),
]);
export type FormatResponse = z.infer<typeof formatResponseSchema>;
