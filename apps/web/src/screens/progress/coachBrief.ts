import {
  MAX_RUBRIC_SCORE,
  TOPIC_LABEL,
  type DashboardResponse,
  type TopicSkill,
} from '@devpromax/shared';

/**
 * The coach's brief on Progress (ROADMAP P9-6, docs/DESIGN.md 8).
 *
 * One sentence and the signals behind it, written from the coach's own rubric
 * marks and the review queue - not by calling the coach. D13 is absolute: the
 * LLM is asked only when the user presses AI Help, and a dashboard that spent
 * money every time it was opened would be exactly the automatic call it rules
 * out. So this is the coach's *record*, read back in its voice: it names only
 * what the marks and the queue already say, and says so when there are none.
 *
 * Pure, so the sentence can be tested against every shape of history.
 */

export interface CoachBrief {
  headline: string;
  signals: string[];
}

function score(skill: TopicSkill): string {
  return `${skill.average.toFixed(1)} of ${String(MAX_RUBRIC_SCORE)}`;
}

function reviews(n: number): string {
  return `${String(n)} review${n === 1 ? '' : 's'}`;
}

export function coachBrief(data: DashboardResponse): CoachBrief {
  const solved = data.byStatus.solved + data.byStatus.mastered;
  const due = data.reviews.due.length;
  const signals: string[] = [];

  // Weakest first; strongest is the far end of the same list.
  const weakest = data.skills[0];
  const strongest = data.skills.length > 1 ? data.skills[data.skills.length - 1] : undefined;

  if (weakest)
    signals.push(
      `Weakest: ${TOPIC_LABEL[weakest.topic]}, ${score(weakest)} over ${reviews(weakest.samples)}.`,
    );
  if (strongest)
    signals.push(
      `Strongest: ${TOPIC_LABEL[strongest.topic]}, ${score(strongest)} over ${reviews(strongest.samples)}.`,
    );
  if (due > 0)
    signals.push(`${String(due)} solved problem${due === 1 ? ' is' : 's are'} due for review.`);
  if (data.streak.current > 0)
    signals.push(
      `${String(data.streak.current)}-day streak; longest ${String(data.streak.longest)}.`,
    );

  let headline: string;
  if (solved === 0) {
    headline =
      'Nothing solved yet. Start with the first easy problem in any topic, and ask me once you have code.';
  } else if (weakest && strongest && weakest.topic !== strongest.topic) {
    headline = `You are strongest in ${TOPIC_LABEL[strongest.topic]} and weakest in ${TOPIC_LABEL[weakest.topic]}${due > 0 ? `, with ${String(due)} due for review` : ''}.`;
  } else if (weakest) {
    headline = `So far I have only marked your ${TOPIC_LABEL[weakest.topic]} work: ${score(weakest)}.`;
  } else if (due > 0) {
    headline = `${String(due)} of your solves ${due === 1 ? 'is' : 'are'} due for review. Re-solve ${due === 1 ? 'it' : 'them'} from memory before starting something new.`;
  } else {
    headline = `${String(solved)} solved, none of it reviewed yet - so there is no weakest topic to name.`;
  }

  return { headline, signals };
}
