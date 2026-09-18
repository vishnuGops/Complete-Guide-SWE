import {
  INTERVIEW_BUDGET_MS,
  INTERVIEW_PROBLEM_COUNT,
  STAGE_PROMPT,
  nextStage,
  statusRank,
  type CoachStreamEvent,
  type Interview,
  type InterviewProblem,
  type InterviewStage,
  type ProblemSummary,
} from '@devpromax/shared';
import { interviewerPrompt } from '../coach/index.js';
import { nowIso } from '../db/open.js';
import type { InterviewRow } from '../db/repos/interviews.js';
import { badRequest, notFound } from './errors.js';
import { listProblems, type ProblemServiceDeps } from './problemService.js';
import { streamCoachTurn, type CoachServiceDeps } from './coachService.js';
import { weakestTopic } from './nextService.js';
import { skillsFrom } from './dashboardService.js';

/**
 * Mock interviews (ROADMAP P9-1).
 *
 * The sitting is a small state machine - approach, coding, review, per problem,
 * then a debrief - and the interviewer is the coach's provider seam driven by a
 * different system prompt. Almost nothing here is new machinery: what is new is
 * the *shape*, which is the part practice normally leaves out. You say what you
 * are going to do before you do it, and someone asks why.
 */

export type InterviewDeps = ProblemServiceDeps & CoachServiceDeps;

/**
 * Two problems: one to warm up on, one that is actually hard.
 *
 * The easier one comes first because a screen that opens with the hardest thing
 * in it measures nerve rather than skill. Both are unsolved - being asked
 * something you did last week is not an interview - and the harder one comes
 * from the weakest topic when there is a weakest topic, because the point of
 * practising under a clock is to find out what falls over under one.
 */
export function chooseProblems(
  all: readonly ProblemSummary[],
  weakest: string | null,
): ProblemSummary[] {
  const unsolved = all.filter((p) => statusRank(p.status) < statusRank('solved'));
  if (unsolved.length === 0) return [];

  const byRating = [...unsolved].sort((a, b) => a.rating - b.rating);
  const warmUp = byRating.find((p) => p.tier === 'Easy') ?? byRating[0];
  if (!warmUp) return [];

  const rest = byRating.filter((p) => p.slug !== warmUp.slug);
  const harder = rest.filter((p) => p.tier !== 'Easy');
  const pool = harder.length > 0 ? harder : rest;

  const fromWeakest = weakest === null ? undefined : pool.find((p) => p.topic === weakest);
  // The middle of the pool rather than the hardest problem in the catalogue: an
  // interview nobody can finish measures nothing either.
  const main = fromWeakest ?? pool[Math.floor(pool.length / 2)] ?? pool[0];

  return main ? [warmUp, main] : [warmUp];
}

/** How much of the budget is left, floored at zero. */
function remaining(row: InterviewRow, now: string): number {
  const elapsed = new Date(now).getTime() - new Date(row.createdAt).getTime();
  return Math.max(0, row.budgetMs - elapsed);
}

function describe(row: InterviewRow, deps: InterviewDeps, now = nowIso()): Interview {
  const problems: InterviewProblem[] = [];
  for (const slug of row.slugs) {
    const meta = deps.catalogue.get(slug)?.meta;
    if (!meta) continue;

    // Only what happened *during* this sitting: a problem solved last month is
    // not an answer given today.
    const since = row.slugs.length > 0 ? row.createdAt : now;
    const submissions = deps.repos.submissions
      .list({ slug })
      .filter((entry) => entry.createdAt >= since);

    problems.push({
      slug,
      title: meta.title,
      topic: meta.topic,
      tier: meta.tier,
      rating: meta.rating,
      attempted: submissions.length > 0,
      solved: submissions.some((entry) => entry.verdict === 'AC'),
    });
  }

  return {
    id: row.id,
    problems,
    budgetMs: row.budgetMs,
    at: row.at,
    stage: row.stage,
    sessionId: row.sessionId,
    debrief: row.debrief,
    createdAt: row.createdAt,
    endedAt: row.endedAt,
    remainingMs: row.endedAt === null ? remaining(row, now) : 0,
  };
}

export function startInterview(deps: InterviewDeps): Interview {
  const all = listProblems(
    { topic: [], tier: [], status: [], sort: 'default', dir: 'asc' },
    deps,
  ).items;

  const skills = skillsFrom(
    deps.repos.coach.scoredTurns(),
    (slug) => all.find((summary) => summary.slug === slug)?.topic,
  );
  const weakest = weakestTopic(skills, all);
  const chosen = chooseProblems(all, weakest?.topic ?? null);

  if (chosen.length < INTERVIEW_PROBLEM_COUNT) {
    throw badRequest(
      'A mock interview needs two unsolved problems, and there are not two left. Reset progress, or come back after the catalogue grows.',
    );
  }

  const row = deps.repos.interviews.create({
    slugs: chosen.map((problem) => problem.slug),
    budgetMs: INTERVIEW_BUDGET_MS,
  });
  return describe(row, deps);
}

export function currentInterview(deps: InterviewDeps): Interview | null {
  const row = deps.repos.interviews.latest();
  return row === null ? null : describe(row, deps);
}

export function getInterview(id: string, deps: InterviewDeps): Interview {
  const row = deps.repos.interviews.get(id);
  if (row === null) throw notFound('That interview no longer exists.');
  return describe(row, deps);
}

/**
 * Moves to the next stage, or the next problem.
 *
 * Driven by the candidate rather than by the clock: an interviewer does not cut
 * someone off mid-sentence because a timer fired, and a sitting that advanced
 * itself would leave them talking to a screen that had moved on.
 */
export function advanceInterview(id: string, deps: InterviewDeps): Interview {
  const row = deps.repos.interviews.get(id);
  if (row === null) throw notFound('That interview no longer exists.');
  if (row.endedAt !== null) throw badRequest('That interview is over.');

  const after: InterviewStage = nextStage(row.stage);
  if (after !== row.stage) {
    return describe(deps.repos.interviews.update(id, { stage: after }) ?? row, deps);
  }

  // `review` is the last stage of a problem, so advancing from it is moving on.
  const at = row.at + 1;
  if (at >= row.slugs.length) {
    return describe(deps.repos.interviews.update(id, { at, stage: 'debrief' }) ?? row, deps);
  }
  return describe(deps.repos.interviews.update(id, { at, stage: 'approach' }) ?? row, deps);
}

/** What the interviewer is told about where the sitting has got to. */
function situation(row: InterviewRow, deps: InterviewDeps, forDebrief: boolean): string {
  const view = describe(row, deps);
  const lines: string[] = [];

  lines.push(
    forDebrief
      ? 'The interview is over. Write the debrief.'
      : `Stage: ${row.stage}. ${STAGE_PROMPT[row.stage]}`,
  );
  lines.push(
    `Time: ${String(Math.round(view.remainingMs / 60_000))} minute(s) left of ${String(Math.round(row.budgetMs / 60_000))}.`,
  );

  view.problems.forEach((problem, index) => {
    const marker = index === row.at && !forDebrief ? ' (current)' : '';
    const outcome = problem.solved
      ? 'submitted and accepted'
      : problem.attempted
        ? 'submitted, not accepted'
        : 'nothing submitted';
    lines.push(
      `Problem ${String(index + 1)}${marker}: ${problem.title} (${problem.tier}, rating ${String(problem.rating)}) - ${outcome}.`,
    );
  });

  const current = deps.catalogue.get(view.problems[row.at]?.slug ?? '');
  if (current && !forDebrief) {
    lines.push('', 'The problem they are on:', current.statement);
    const draft = deps.repos.drafts.listByProblem(current.meta.slug);
    if (draft.length > 0) {
      lines.push('', 'What is in their editor right now:');
      for (const entry of draft) {
        lines.push(`\`\`\`${entry.language}\n${entry.code}\n\`\`\``);
      }
    }
  }

  if (forDebrief) {
    // The code they finished with, for every problem: a debrief that has not
    // seen the code can only comment on what was said about it.
    for (const problem of view.problems) {
      for (const entry of deps.repos.drafts.listByProblem(problem.slug)) {
        lines.push('', `${problem.title}, their ${entry.language}:`);
        lines.push(`\`\`\`${entry.language}\n${entry.code}\n\`\`\``);
      }
    }
  }

  return lines.join('\n');
}

/**
 * One exchange: the candidate says something, the interviewer answers.
 *
 * Goes through the coach's own streaming path, so the spend cap, the usage
 * accounting, the abort handling and the history window are the ones already
 * built and tested (P5-6, P5-9) rather than a second copy of them.
 */
export async function* sayToInterviewer(
  id: string,
  message: string,
  deps: InterviewDeps,
  signal?: AbortSignal,
): AsyncGenerator<CoachStreamEvent> {
  const row = deps.repos.interviews.get(id);
  if (row === null) throw notFound('That interview no longer exists.');
  if (row.endedAt !== null) throw badRequest('That interview is over.');

  const slug = row.slugs[Math.min(row.at, row.slugs.length - 1)];
  if (slug === undefined) throw badRequest('That interview has no problems in it.');

  const session =
    (row.sessionId === null ? null : deps.repos.coach.getSession(row.sessionId)) ??
    deps.repos.coach.createSession(slug, deps.repos.settings.get().lastLanguage);
  if (row.sessionId !== session.id) {
    deps.repos.interviews.update(id, { sessionId: session.id });
  }

  yield* streamCoachTurn(
    {
      sessionId: session.id,
      system: interviewerPrompt(),
      // The situation goes with the message rather than into history: it is
      // true *now*, and a stale copy of it three turns back would have the
      // interviewer asking about a stage the candidate has left.
      message: `${situation(row, deps, false)}\n\n---\n\nThe candidate says:\n\n${message}`,
      stored: message,
    },
    deps,
    signal,
  );
}

/**
 * Ends the sitting and writes the debrief.
 *
 * Streamed like any other turn, so the candidate watches it being written
 * rather than staring at a spinner for thirty seconds, and stored when it is
 * finished so the screen can be reopened.
 */
export async function* finishInterview(
  id: string,
  deps: InterviewDeps,
  signal?: AbortSignal,
): AsyncGenerator<CoachStreamEvent> {
  const row = deps.repos.interviews.get(id);
  if (row === null) throw notFound('That interview no longer exists.');
  if (row.endedAt !== null) throw badRequest('That interview is already over.');

  const slug = row.slugs[0];
  if (slug === undefined) throw badRequest('That interview has no problems in it.');

  const session =
    (row.sessionId === null ? null : deps.repos.coach.getSession(row.sessionId)) ??
    deps.repos.coach.createSession(slug, deps.repos.settings.get().lastLanguage);

  let debrief = '';
  for await (const event of streamCoachTurn(
    {
      sessionId: session.id,
      system: interviewerPrompt(),
      message: situation(row, deps, true),
      stored: 'That is time. How did I do?',
    },
    deps,
    signal,
  )) {
    if (event.type === 'reply') debrief = event.content;
    yield event;
  }

  /*
   * Ended whether or not a debrief arrived.
   *
   * A sitting that failed to produce one - no key, the cap, a provider outage -
   * is still over, and leaving it open would mean the next "start an interview"
   * reopened this one. The screen shows the failure and offers a new sitting.
   */
  deps.repos.interviews.update(id, {
    stage: 'done',
    endedAt: nowIso(),
    ...(debrief === '' ? {} : { debrief }),
  });
}
