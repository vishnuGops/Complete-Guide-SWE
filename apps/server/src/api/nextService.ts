import {
  TOPIC_LABEL,
  statusRank,
  type NextMode,
  type NextProblemResponse,
  type ProblemSummary,
  type Topic,
  type TopicSkill,
} from '@devpromax/shared';
import { skillsFrom } from './dashboardService.js';
import { listProblems, type ProblemServiceDeps } from './problemService.js';

/**
 * "What should I do next" (ROADMAP P7-7).
 *
 * Two modes, and the difference between them is the whole point. `random` is an
 * honest coin toss for when the user wants to stop choosing; `recommended` is
 * the lowest-rated unsolved problem in whichever topic they are weakest at,
 * which is the one thing a practice app knows that the user does not.
 *
 * Both answer with a reason. A recommendation with no stated reason is
 * indistinguishable from a random pick, and one of these two *is* a random pick.
 */

function unsolved(summary: ProblemSummary): boolean {
  return statusRank(summary.status) < statusRank('solved');
}

/**
 * The topic to work on, and why.
 *
 * The coach's rubric scores are the better signal and are used whenever they
 * exist - they say what someone is bad at rather than what they have not got to
 * yet. Before there are any, the fallback is the topic with the least of it
 * done, which is at least a topic they have been avoiding.
 */
export function weakestTopic(
  skills: readonly TopicSkill[],
  summaries: readonly ProblemSummary[],
): { topic: Topic; reason: string } | null {
  const scored = skills.find((skill) =>
    summaries.some((s) => s.topic === skill.topic && unsolved(s)),
  );
  if (scored) {
    return {
      topic: scored.topic,
      reason: `${TOPIC_LABEL[scored.topic]} is your lowest-scoring topic with the coach (${scored.average.toFixed(1)} out of 4 over ${String(scored.samples)} review${scored.samples === 1 ? '' : 's'}).`,
    };
  }

  const byTopic = new Map<Topic, { total: number; done: number }>();
  for (const summary of summaries) {
    const entry = byTopic.get(summary.topic) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (!unsolved(summary)) entry.done += 1;
    byTopic.set(summary.topic, entry);
  }

  let chosen: { topic: Topic; ratio: number } | null = null;
  for (const [topic, entry] of byTopic) {
    if (entry.done === entry.total) continue;
    const ratio = entry.done / entry.total;
    // Strictly less, so ties go to the first topic in curriculum order rather
    // than to whichever the map happened to yield last.
    if (chosen === null || ratio < chosen.ratio) chosen = { topic, ratio };
  }
  if (chosen === null) return null;

  return {
    topic: chosen.topic,
    reason: `${TOPIC_LABEL[chosen.topic]} is the topic you have done least of. The coach has not scored anything yet, so this is by how much is left rather than by how it went.`,
  };
}

export function nextProblem(
  mode: NextMode,
  deps: ProblemServiceDeps,
  random: () => number = Math.random,
): NextProblemResponse {
  const all = listProblems(
    { topic: [], tier: [], status: [], sort: 'default', dir: 'asc' },
    deps,
  ).items;
  const candidates = all.filter(unsolved);

  if (candidates.length === 0) {
    return {
      problem: null,
      reason:
        all.length === 0
          ? 'There are no problems in the catalogue yet.'
          : 'Every problem in the catalogue is solved. There is nothing left to suggest.',
    };
  }

  if (mode === 'random') {
    const pick = candidates[Math.floor(random() * candidates.length)] ?? candidates[0];
    return {
      problem: pick ?? null,
      reason: `Picked at random from the ${String(candidates.length)} problems you have not solved.`,
    };
  }

  const skills = skillsFrom(
    deps.repos.coach.scoredTurns(),
    (slug) => all.find((summary) => summary.slug === slug)?.topic,
  );
  const weakest = weakestTopic(skills, all);
  const pool = weakest
    ? candidates.filter((summary) => summary.topic === weakest.topic)
    : candidates;

  // `listProblems` already sorts by rating then curriculum order, so the first
  // in the pool is the easiest unsolved one in it - which is what "start here"
  // has to mean, or the recommendation is a wall rather than a way in.
  const pick = pool[0] ?? candidates[0];
  return {
    problem: pick ?? null,
    reason: weakest
      ? `${weakest.reason} This is the lowest-rated one left in it.`
      : 'The lowest-rated problem you have not solved.',
  };
}
