import {
  MAX_RUBRIC_SCORE,
  TOPIC_LABEL,
  solvedCount,
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

/** The mark as it is printed. Two topics whose marks read the same are level. */
function shown(skill: TopicSkill): string {
  return skill.average.toFixed(1);
}

/** "Graph", "Graph and Heap", "Graph, Heap and Stack". */
function topics(skills: readonly TopicSkill[]): string {
  const names = skills.map((skill) => TOPIC_LABEL[skill.topic]);
  const last = names.pop() ?? '';
  return names.length === 0 ? last : `${names.join(', ')} and ${last}`;
}

/** One end of the marks: its topics, and the signal line that names them. */
function end(label: string, group: TopicSkill[], mark: TopicSkill): string {
  // One topic says how many reviews stand behind its mark; a group has a mark
  // in common and nothing else, so it says just that.
  return group.length === 1
    ? `${label}: ${TOPIC_LABEL[mark.topic]}, ${score(mark)} over ${reviews(mark.samples)}.`
    : `${label}: ${topics(group)}, ${score(mark)}.`;
}

export function coachBrief(data: DashboardResponse): CoachBrief {
  const solved = solvedCount(data.byStatus);
  const due = data.reviews.due.length;
  const signals: string[] = [];

  /*
   * Weakest first; strongest is the far end of the same list. Ties are named
   * as ties (P4-17): the order between equal marks is only the server's
   * tie-break, and "strongest in Graph and weakest in Heap" over two topics
   * both at 2.5 is a judgement the marks never made.
   */
  const weakest = data.skills[0];
  const strongest = data.skills.at(-1);
  const weakestGroup = weakest
    ? data.skills.filter((skill) => shown(skill) === shown(weakest))
    : [];
  const strongestGroup = strongest
    ? data.skills.filter((skill) => shown(skill) === shown(strongest))
    : [];
  /** More than one topic marked, all of them the same: no strongest, no weakest. */
  const level = data.skills.length > 1 && weakestGroup.length === data.skills.length;
  const spread =
    weakest !== undefined && strongest !== undefined && data.skills.length > 1 && !level;

  if (level && weakest) {
    signals.push(`Level: ${topics(data.skills)}, all at ${score(weakest)}.`);
  } else if (weakest) {
    signals.push(end('Weakest', weakestGroup, weakest));
    if (spread) signals.push(end('Strongest', strongestGroup, strongest));
  }
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
  } else if (spread) {
    headline = `You are strongest in ${topics(strongestGroup)} and weakest in ${topics(weakestGroup)}${due > 0 ? `, with ${String(due)} due for review` : ''}.`;
  } else if (level && weakest) {
    headline = `My marks so far are level: ${topics(data.skills)}, all at ${score(weakest)}.`;
  } else if (weakest) {
    headline = `So far I have only marked your ${TOPIC_LABEL[weakest.topic]} work: ${score(weakest)}.`;
  } else if (due > 0) {
    headline = `${String(due)} of your solves ${due === 1 ? 'is' : 'are'} due for review. Re-solve ${due === 1 ? 'it' : 'them'} from memory before starting something new.`;
  } else {
    headline = `${String(solved)} solved, none of it reviewed yet - so there is no weakest topic to name.`;
  }

  return { headline, signals };
}
