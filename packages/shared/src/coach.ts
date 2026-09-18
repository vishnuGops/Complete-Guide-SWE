import { z } from 'zod';
import { languageSchema } from './language.js';
import { slugSchema } from './problem.js';

/**
 * The rubric the coach scores against (ROADMAP P5-2). Fixed set: the dashboard
 * aggregates these dimensions into "weakest topics", so they cannot vary per
 * problem.
 */
export const RUBRIC_DIMENSIONS = [
  'correctness',
  'timeComplexity',
  'spaceComplexity',
  'edgeCases',
  'readability',
] as const;
export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];

export const RUBRIC_LABEL: Record<RubricDimension, string> = {
  correctness: 'Correctness',
  timeComplexity: 'Time complexity',
  spaceComplexity: 'Space complexity',
  edgeCases: 'Edge cases',
  readability: 'Readability',
};

/** Scores are 0-4 so there is no "3 out of 5 is a pass" ambiguity. */
export const MAX_RUBRIC_SCORE = 4;

/** Every dimension must reach this for the coach to return `mastered`. */
export const MASTERY_THRESHOLD = 4;

const scoreSchema = z.int().min(0).max(MAX_RUBRIC_SCORE);

export const rubricScoresSchema = z.object({
  correctness: scoreSchema,
  timeComplexity: scoreSchema,
  spaceComplexity: scoreSchema,
  edgeCases: scoreSchema,
  readability: scoreSchema,
});
export type RubricScores = z.infer<typeof rubricScoresSchema>;

export function meetsMastery(scores: RubricScores): boolean {
  return RUBRIC_DIMENSIONS.every((d) => scores[d] >= MASTERY_THRESHOLD);
}

/**
 * The hint ladder (D13 / P5-2). `solution` is only reachable when the problem is
 * already Solved and the user explicitly asked for it.
 */
export const HINT_LEVELS = ['nudge', 'concept', 'approach', 'pseudocode', 'solution'] as const;
export const hintLevelSchema = z.enum(HINT_LEVELS);
export type HintLevel = z.infer<typeof hintLevelSchema>;

export function hintLevelRank(level: HintLevel): number {
  return HINT_LEVELS.indexOf(level);
}

/** Structured output the provider must return (D13). Drives the rubric card and status engine. */
export const coachFeedbackSchema = z.object({
  /** One-line summary, shown collapsed in the panel header. */
  summary: z.string().min(1).max(280),
  scores: rubricScoresSchema,
  /** Body of the feedback; rendered as sanitised markdown. */
  feedbackMarkdown: z.string().min(1),
  /** The rung the coach chose to give next, or null when no hint is warranted. */
  nextHintLevel: hintLevelSchema.nullable().default(null),
  /** Single concrete next action, rendered as a callout. */
  nextStep: z.string().min(1).max(400).optional(),
  /**
   * The coach's own verdict. The status engine still gates on an accepted
   * submission, so a `true` here alone cannot promote to Mastered.
   */
  mastered: z.boolean(),
});
export type CoachFeedback = z.infer<typeof coachFeedbackSchema>;

export const hintsFileSchema = z.object({
  /** Static ladder authored with the problem; the no-key fallback (P7-1). */
  hints: z.array(z.string().min(1)).min(1),
});
export type HintsFile = z.infer<typeof hintsFileSchema>;

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const COACH_PROVIDERS = ['anthropic', 'gemini'] as const;
export const coachProviderSchema = z.enum(COACH_PROVIDERS);
export type CoachProvider = z.infer<typeof coachProviderSchema>;

export const COACH_PROVIDER_LABEL: Record<CoachProvider, string> = {
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
};

export const coachFeedbackRequestSchema = z.object({
  slug: slugSchema,
  language: languageSchema,
  code: z.string().min(1),
  /** Hint rungs the user has already revealed; the coach must not repeat them. */
  revealedHints: z.int().min(0).default(0),
  /** True when the user explicitly asked for a mastery check after an AC. */
  masteryCheck: z.boolean().default(false),
  /** True when the user explicitly asked to see the full solution. */
  requestFullSolution: z.boolean().default(false),
  /**
   * The interview-mode timer was running when this was asked (P7-6).
   *
   * Adds the "Saying it out loud" section to the answer. Only here: practice
   * that is not against a clock does not need a paragraph about explaining
   * yourself, and one on every review would be padding.
   */
  interviewMode: z.boolean().default(false),
  /**
   * Start a fresh conversation rather than continuing the latest one (P5-9).
   *
   * This is the route out of `spend_cap_reached`, which has always told the
   * user to start a new one while nothing let them. It also resets the prompt
   * window (D20), so a conversation that has wandered can be abandoned without
   * abandoning the problem.
   */
  newConversation: z.boolean().default(false),
});
export type CoachFeedbackRequest = z.infer<typeof coachFeedbackRequestSchema>;

/**
 * Why a coach request was refused before any tokens were spent (D13 pre-check).
 * These are produced locally, never by a provider.
 */
export const COACH_SKIP_REASONS = [
  'unchanged_starter',
  'no_meaningful_code',
  'no_api_key',
  'spend_cap_reached',
] as const;
export const coachSkipReasonSchema = z.enum(COACH_SKIP_REASONS);
export type CoachSkipReason = z.infer<typeof coachSkipReasonSchema>;

export const COACH_SKIP_MESSAGE: Record<CoachSkipReason, string> = {
  unchanged_starter: 'Write some code first, then ask for help.',
  no_meaningful_code: 'There is no solution body to review yet. Sketch an approach first.',
  no_api_key: 'Add an Anthropic or Gemini API key in Settings to use AI Help.',
  spend_cap_reached:
    'This conversation has reached the spend cap set in Settings. Raise it there, or start a fresh one.',
};

/** A follow-up question in an existing conversation (`POST /api/coach/chat`). */
export const coachChatRequestSchema = z.object({
  sessionId: z.uuid(),
  message: z.string().min(1).max(4000),
});
export type CoachChatRequest = z.infer<typeof coachChatRequestSchema>;

// ---------------------------------------------------------------------------
// The wire format of a coaching turn
// ---------------------------------------------------------------------------

/**
 * What the two coach routes send, one event per SSE frame (P5-3).
 *
 * Errors are events rather than HTTP statuses because by the time a provider
 * fails, the response has usually already begun: the status line went out with
 * the first token. A client that only checked `response.ok` would show a
 * half-written answer and no indication that it stopped. `retryable` is carried
 * through from `CoachProviderError` so the panel can offer the right button.
 */
export const coachStreamEventSchema = z.discriminatedUnion('type', [
  /** The conversation this turn belongs to, sent once before any text. */
  z.object({
    type: z.literal('start'),
    sessionId: z.uuid(),
  }),
  /** A new piece of `feedbackMarkdown`, to append. */
  z.object({
    type: z.literal('markdown'),
    delta: z.string(),
  }),
  /** The validated whole. Absent when the turn ended in an error. */
  z.object({
    type: z.literal('done'),
    feedback: coachFeedbackSchema,
  }),
  /** Plain prose, for a chat reply that has no rubric attached. */
  z.object({
    type: z.literal('reply'),
    content: z.string(),
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
    retryable: z.boolean(),
  }),
  /**
   * The local pre-check refused before any token was spent (D13). Not an error:
   * nothing went wrong, the request was simply not worth making.
   */
  z.object({
    type: z.literal('skipped'),
    reason: coachSkipReasonSchema,
    message: z.string(),
  }),
]);
export type CoachStreamEvent = z.infer<typeof coachStreamEventSchema>;
