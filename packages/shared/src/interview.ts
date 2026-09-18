import { z } from 'zod';
import { slugSchema } from './problem.js';
import { tierSchema, topicSchema } from './curriculum.js';

/**
 * Mock interviews (ROADMAP P9-1).
 *
 * Two problems and a clock, with an interviewer that asks for the approach
 * before the code, probes the complexity after it, and writes a debrief at the
 * end. The point is the part practice normally leaves out: saying out loud what
 * you are about to do, and being asked why.
 */

/** Forty-five minutes, which is what a real screen is. */
export const INTERVIEW_BUDGET_MS = 45 * 60 * 1000;

/** Two, because one is a practice session and three is an afternoon. */
export const INTERVIEW_PROBLEM_COUNT = 2;

/**
 * What the candidate is doing at any moment.
 *
 * `approach` before `coding` is the whole shape of the thing: an interview
 * where you open the editor first is the practice session you were already
 * doing.
 */
export const INTERVIEW_STAGES = ['approach', 'coding', 'review', 'debrief', 'done'] as const;
export const interviewStageSchema = z.enum(INTERVIEW_STAGES);
export type InterviewStage = z.infer<typeof interviewStageSchema>;

export const interviewProblemSchema = z.object({
  slug: slugSchema,
  title: z.string(),
  topic: topicSchema,
  tier: tierSchema,
  rating: z.int(),
  /** Whether it has been submitted since this interview started. */
  attempted: z.boolean(),
  /** Whether one of those submissions was accepted. */
  solved: z.boolean(),
});
export type InterviewProblem = z.infer<typeof interviewProblemSchema>;

export const interviewSchema = z.object({
  id: z.uuid(),
  problems: z.array(interviewProblemSchema),
  budgetMs: z.int().min(1),
  /** 0-based index into `problems`; equal to its length once the last is done. */
  at: z.int().min(0),
  stage: interviewStageSchema,
  /** The coach conversation the interviewer's turns live in, once there is one. */
  sessionId: z.uuid().nullable(),
  /** Markdown, written at the end; null while it is still running. */
  debrief: z.string().nullable(),
  createdAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  /** Milliseconds left on the clock, or 0 once it is over. */
  remainingMs: z.int().min(0),
});
export type Interview = z.infer<typeof interviewSchema>;

/** `null` when there has never been one, which is a different screen. */
export const interviewResponseSchema = z.object({
  interview: interviewSchema.nullable(),
});
export type InterviewResponse = z.infer<typeof interviewResponseSchema>;

export const interviewSaySchema = z.object({
  /** What the candidate said - the approach, an answer to a probe, a question. */
  message: z.string().min(1).max(8_000),
});
export type InterviewSay = z.infer<typeof interviewSaySchema>;

/** Where a stage goes when the candidate moves on. */
export function nextStage(stage: InterviewStage): InterviewStage {
  if (stage === 'approach') return 'coding';
  if (stage === 'coding') return 'review';
  return stage;
}

/**
 * What the screen tells the candidate to do now.
 *
 * In shared rather than in the UI because the interviewer's prompt is built
 * from the same fact on the server, and two descriptions of one state drift.
 */
export const STAGE_PROMPT: Record<InterviewStage, string> = {
  approach:
    'Read the problem, then say how you would solve it - in words, before any code. The interviewer will push back.',
  coding: 'Write it. Come back when you have something you would show an interviewer.',
  review: 'Talk about what you wrote: the complexity, what it costs, what you would change.',
  debrief: 'Time to look back at the whole thing.',
  done: 'This interview is over.',
};
