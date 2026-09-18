import {
  DAY_MS,
  reviewDueAt,
  statusRank,
  type ReviewItem,
  type ReviewQueue,
} from '@devpromax/shared';
import { nowIso } from '../db/open.js';
import type { ProblemServiceDeps } from './problemService.js';

/**
 * The review queue (ROADMAP P7-8).
 *
 * Derived from the submission archive rather than from a schedule table, which
 * is the same choice P7-1 and P7-2 made and for the same reason: an accepted
 * submission *is* a pass, so counting them is counting reviews, and re-solving
 * a problem advances the queue with no extra write and nothing to get out of
 * step. It also means the queue is right for practice done before this feature
 * existed.
 *
 * A pass is an accepted submission in either language. Re-solving in Java what
 * you solved in Python is a review of the same idea, which is the thing being
 * remembered.
 */

export function reviewQueue(deps: ProblemServiceDeps, now = nowIso()): ReviewQueue {
  const { repos, catalogue } = deps;
  const at = new Date(now).getTime();

  const passes = new Map<string, { count: number; last: string }>();
  for (const submission of repos.submissions.list()) {
    if (submission.verdict !== 'AC') continue;
    const entry = passes.get(submission.slug) ?? { count: 0, last: submission.createdAt };
    entry.count += 1;
    // The list is newest first, so the first accepted row seen is the latest.
    if (submission.createdAt > entry.last) entry.last = submission.createdAt;
    passes.set(submission.slug, entry);
  }

  const items: ReviewItem[] = [];
  for (const [slug, entry] of passes) {
    const meta = catalogue.get(slug)?.meta;
    // A problem that has left the catalogue cannot be reviewed, and a queue row
    // pointing at a 404 is worse than a shorter queue.
    if (meta === undefined) continue;

    const rows = repos.progress.listByProblem(slug);
    const mastered = rows.some((row) => statusRank(row.status) >= statusRank('mastered'));
    const best = rows.reduce(
      (acc, row) => (statusRank(row.status) > statusRank(acc) ? row.status : acc),
      'not_started' as ReviewItem['status'],
    );
    const dueAt = reviewDueAt(entry.last, entry.count, mastered);

    items.push({
      slug,
      title: meta.title,
      topic: meta.topic,
      tier: meta.tier,
      status: best,
      lastPassedAt: entry.last,
      passes: entry.count,
      dueAt,
      // Whole days, floored, so "due today" reads as 0 rather than as 0.4.
      overdueDays: Math.floor((at - new Date(dueAt).getTime()) / DAY_MS),
    });
  }

  const due = items
    .filter((item) => new Date(item.dueAt).getTime() <= at)
    // Most overdue first: the thing you are furthest from remembering is the
    // thing to do next.
    .sort((a, b) => b.overdueDays - a.overdueDays || a.dueAt.localeCompare(b.dueAt));

  const upcoming = items
    .filter((item) => new Date(item.dueAt).getTime() > at)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return { due, upcoming };
}
