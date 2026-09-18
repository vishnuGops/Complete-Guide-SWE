import {
  RUBRIC_DIMENSIONS,
  TOPICS,
  type ActiveDay,
  type DashboardResponse,
  type RecentActivity,
  type Streak,
  type TopicSkill,
} from '@devpromax/shared';
import { nowIso } from '../db/open.js';
import { progressOverview, type ProblemServiceDeps } from './problemService.js';
import { reviewQueue } from './reviewService.js';

/**
 * The progress dashboard (ROADMAP P7-5).
 *
 * Everything here is derived at read time from tables that are already written:
 * the events log for the streak and the recent list, the coach's stored
 * feedback for the skills breakdown, the catalogue and progress rows for the
 * counts. Nothing is precomputed, because a dashboard that is a cache is a
 * dashboard that can be wrong, and the whole database is one person's practice.
 */

const RECENT_LIMIT = 20;
/** A year of calendar, which is what a streak calendar shows. */
const CALENDAR_DAYS = 365;

function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

function dayBefore(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Consecutive active days, counted backwards from today.
 *
 * Today being quiet does not break the streak - the day is not over - so a run
 * that ends yesterday still counts this morning. It does break once yesterday
 * is quiet too.
 */
export function streakFrom(days: readonly ActiveDay[], today: string): Streak {
  const active = new Set(days.map((entry) => entry.day));

  let current = 0;
  let cursor = active.has(today) ? today : dayBefore(today);
  while (active.has(cursor)) {
    current += 1;
    cursor = dayBefore(cursor);
  }

  // Sorted ascending so a run is a walk forwards; `days` arrives newest first.
  const ordered = [...active].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of ordered) {
    run = previous !== null && dayBefore(day) === previous ? run + 1 : 1;
    previous = day;
    if (run > longest) longest = run;
  }

  return { current, longest, days: [...days] };
}

function verdictOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const verdict = (payload as Record<string, unknown>)['verdict'];
  return typeof verdict === 'string' ? verdict : null;
}

/**
 * Topic averages over every scored coach turn, weakest first.
 *
 * Every turn counts, not just the last one per problem: a topic someone needed
 * four goes at is a topic they find hard, and keeping only the final score
 * would erase exactly that. Ties break on sample count, so the topic with more
 * evidence behind the same average is the one named first.
 */
export function skillsFrom(
  turns: readonly { slug: string; feedback: { scores: Record<string, number> } }[],
  topicOf: (slug: string) => string | undefined,
): TopicSkill[] {
  const totals = new Map<string, { samples: number; sums: Record<string, number> }>();

  for (const turn of turns) {
    const topic = topicOf(turn.slug);
    if (topic === undefined) continue;
    const entry = totals.get(topic) ?? {
      samples: 0,
      sums: Object.fromEntries(RUBRIC_DIMENSIONS.map((d) => [d, 0])),
    };
    entry.samples += 1;
    for (const dimension of RUBRIC_DIMENSIONS) {
      entry.sums[dimension] = (entry.sums[dimension] ?? 0) + (turn.feedback.scores[dimension] ?? 0);
    }
    totals.set(topic, entry);
  }

  const skills: TopicSkill[] = [];
  for (const topic of TOPICS) {
    const entry = totals.get(topic);
    if (entry === undefined || entry.samples === 0) continue;
    const scores: Record<string, number> = {};
    for (const dimension of RUBRIC_DIMENSIONS) {
      scores[dimension] = (entry.sums[dimension] ?? 0) / entry.samples;
    }
    const average =
      RUBRIC_DIMENSIONS.reduce((sum, d) => sum + (scores[d] ?? 0), 0) / RUBRIC_DIMENSIONS.length;
    skills.push({ topic, samples: entry.samples, scores, average });
  }

  return skills.sort((a, b) => a.average - b.average || b.samples - a.samples);
}

export function dashboard(deps: ProblemServiceDeps): DashboardResponse {
  const { repos } = deps;
  const overview = progressOverview(deps);
  const generatedAt = nowIso();

  const since = new Date(generatedAt);
  since.setUTCDate(since.getUTCDate() - (CALENDAR_DAYS - 1));
  const days = repos.events.dailyCounts(`${since.toISOString().slice(0, 10)}T00:00:00.000Z`);

  const titles = new Map(deps.catalogue.listMeta().map(({ meta }) => [meta.slug, meta]));
  const recent: RecentActivity[] = repos.events.list({ limit: RECENT_LIMIT }).map((event) => ({
    kind: event.type,
    slug: event.slug,
    title: event.slug === null ? null : (titles.get(event.slug)?.title ?? null),
    language: event.language,
    verdict: verdictOf(event.payload),
    at: event.createdAt,
  }));

  return {
    total: overview.total,
    byStatus: overview.byStatus,
    byTopic: overview.byTopic,
    byTier: overview.byTier,
    streak: streakFrom(days, utcDay(generatedAt)),
    recent,
    skills: skillsFrom(repos.coach.scoredTurns(), (slug) => titles.get(slug)?.topic),
    editorialsRevealed: repos.events.list().filter((event) => event.type === 'editorial_revealed')
      .length,
    reviews: reviewQueue(deps, generatedAt),
    generatedAt,
  };
}
