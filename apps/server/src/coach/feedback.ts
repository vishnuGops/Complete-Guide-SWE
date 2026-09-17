import { z } from 'zod';
import { coachFeedbackSchema, type CoachFeedback } from '@devpromax/shared';
import { createStringStreamer } from './partialJson.js';
import {
  CoachProviderError,
  type CoachProvider,
  type CoachTurn,
  type JsonSchema,
} from './provider.js';

/**
 * The vendor-neutral half of a coaching turn (ROADMAP P5-1).
 *
 * `CoachProvider.stream` yields raw JSON text, because that is the honest
 * lowest common denominator between two vendors. Everything above this line
 * wants something quite different: markdown to paint as it arrives, and one
 * validated `CoachFeedback` at the end. Doing that conversion here means it is
 * written once and both providers are held to the same contract - a Gemini
 * response that would not satisfy the schema fails in the same place, with the
 * same message, as an Anthropic one.
 */

export type FeedbackChunk =
  /** A new piece of `feedbackMarkdown`, for the panel to append. */
  | { type: 'markdown'; delta: string }
  /** The validated whole, once the stream has ended. */
  | { type: 'done'; feedback: CoachFeedback };

/**
 * The response schema, as JSON Schema, derived from the zod schema.
 *
 * Generated rather than hand-written so it cannot drift from the parser that
 * checks the answer: a schema that asked for a field the parser rejects would
 * fail on every request, and only in production.
 */
export function coachFeedbackJsonSchema(): JsonSchema {
  return z.toJSONSchema(coachFeedbackSchema, { io: 'input' }) as JsonSchema;
}

export interface FeedbackStreamOptions {
  apiKey: string;
  model: string | null;
  system: string;
  messages: readonly CoachTurn[];
  signal?: AbortSignal;
}

/**
 * Runs one coaching turn, yielding markdown as it is written and the parsed
 * feedback at the end.
 *
 * The raw document is accumulated alongside the deltas because the two answer
 * different questions: the deltas are what to paint, and the accumulated text is
 * what to parse. Deriving the final object from the concatenated deltas instead
 * would be wrong - the deltas are only one field of it.
 */
export async function* streamCoachFeedback(
  provider: CoachProvider,
  options: FeedbackStreamOptions,
): AsyncGenerator<FeedbackChunk> {
  const markdown = createStringStreamer('feedbackMarkdown');
  let raw = '';

  for await (const chunk of provider.stream({
    apiKey: options.apiKey,
    model: options.model,
    system: options.system,
    messages: options.messages,
    schema: coachFeedbackJsonSchema(),
    signal: options.signal,
  })) {
    raw += chunk;
    const delta = markdown.push(raw);
    if (delta !== '') yield { type: 'markdown', delta };
  }

  yield { type: 'done', feedback: parseFeedback(raw) };
}

/**
 * Turns the accumulated response into `CoachFeedback`, or says why it could not.
 *
 * Both failure modes get their own message because they need different fixes: a
 * truncated document means the answer was cut off and retrying may work, while a
 * complete document that fails the schema means the model answered the wrong
 * shape and retrying probably will not.
 */
export function parseFeedback(raw: string): CoachFeedback {
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new CoachProviderError('The coach returned an empty response.', { retryable: true });
  }

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch (error) {
    throw new CoachProviderError('The coach’s answer was cut off before it finished.', {
      retryable: true,
      cause: error,
    });
  }

  const parsed = coachFeedbackSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoachProviderError('The coach answered in an unexpected shape.', {
      cause: parsed.error,
    });
  }

  return parsed.data;
}
