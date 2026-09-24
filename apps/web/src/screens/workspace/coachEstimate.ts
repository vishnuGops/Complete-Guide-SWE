import {
  COACH_EDITORIAL_CAP,
  COACH_MAX_PRIOR_ATTEMPTS,
  COACH_STATEMENT_CAP,
  COACH_SYSTEM_PROMPT_CHARS,
  type ProblemDetail,
} from '@devpromax/shared';

/**
 * How big the next AI Help request will be, in characters (ROADMAP P5-6, P4-15).
 *
 * The output side of the estimate - the answer, and the thinking before it - is
 * the shared `estimateTurnCostUsd`'s business, so the server's spend cap and
 * the number under the button agree on it. This is the input side, which only
 * the client can size: it is what the server's `coach/context.ts` will put in
 * the prompt, mirrored from what the client can see.
 *
 * The first version counted the statement and the code and nothing else, while
 * the prompt also carries the editorial (flagged secret), the hints already
 * read plus the next one, the last judge result and up to three earlier
 * coaching turns. Each is small; left out together they made the estimate a
 * floor rather than an estimate.
 *
 * The editorial is counted when the client has it - once it is unlocked. The
 * server sends it either way, so a locked problem's estimate is short by up to
 * a thousand tokens; guessing its length would put a made-up number into a
 * figure the user is meant to trust.
 *
 * The caps and the system prompt's size come from `@devpromax/shared`, where
 * the server's context builder reads them too, so the two cannot drift apart.
 */

/** Roughly the size of the system prompt; a server test keeps it honest. */
export const SYSTEM_PROMPT_CHARS = COACH_SYSTEM_PROMPT_CHARS;
const STATEMENT_CAP = COACH_STATEMENT_CAP;
const EDITORIAL_CAP = COACH_EDITORIAL_CAP;

/**
 * Up to three earlier rubric turns, each a summary, five scores, a next step
 * and what changed since. The client cannot know how many there are - they
 * are read from the database - so the estimate assumes the most, which errs
 * the way an estimate of money should.
 */
const PRIOR_ATTEMPTS_CHARS = COACH_MAX_PRIOR_ATTEMPTS * 700;

/** The latest judge result: a verdict line and up to three failing tests. */
const JUDGE_RESULT_CHARS = 1_500;

/** Section headings, the request block and the problem's meta lines. */
const FRAMING_CHARS = 800;

export function coachPromptChars(
  problem: ProblemDetail,
  code: string,
  revealedHints: number,
): number {
  const editorial = problem.editorial?.length ?? 0;
  // The hints already read, and the next rung, which is sent as a secret.
  const hints = problem.hints
    .slice(0, revealedHints + 1)
    .reduce((total, hint) => total + hint.length, 0);

  return (
    SYSTEM_PROMPT_CHARS +
    FRAMING_CHARS +
    Math.min(problem.statement.length, STATEMENT_CAP) +
    code.length +
    JUDGE_RESULT_CHARS +
    hints +
    Math.min(editorial, EDITORIAL_CAP) +
    PRIOR_ATTEMPTS_CHARS
  );
}
