import {
  DAY_MS,
  reviewDueAt,
  statusRank,
  type ProblemMeta,
  type ProblemProgress,
  type ReviewItem,
  type ReviewQueue,
} from '@devpromax/shared';
import { nowIso } from '../db/open.js';
import type { Catalogue } from './catalogue.js';
import type { ProblemServiceDeps } from './problemService.js';

/**
 * Every problem's metadata by slug, read once (P3-9).
 *
 * The services that need titles and tiers for many problems build this once
 * per request and pass it along, rather than each asking the catalogue per
 * slug - a question that used to mean a directory walk every time.
 */
export function metaBySlug(catalogue: Catalogue): Map<string, ProblemMeta> {
  return new Map(catalogue.listMeta().map(({ meta }) => [meta.slug, meta]));
}

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

export function reviewQueue(
  deps: ProblemServiceDeps,
  now = nowIso(),
  metas: ReadonlyMap<string, ProblemMeta> = metaBySlug(deps.catalogue),
): ReviewQueue {
  const { repos } = deps;
  const at = new Date(now).getTime();

  /*
   * Two queries, whatever the size of the archive (P3-9). This used to read
   * every submission - code and all - to count the accepted ones, then read the
   * whole package and the progress rows once per solved problem.
   */
  const passes = repos.submissions.acceptedSummary();
  const progress = new Map<string, ProblemProgress[]>();
  for (const row of repos.progress.list()) {
    const existing = progress.get(row.slug);
    if (existing) existing.push(row);
    else progress.set(row.slug, [row]);
  }

  const items: ReviewItem[] = [];
  for (const [slug, entry] of passes) {
    const meta = metas.get(slug);
    // A problem that has left the catalogue cannot be reviewed, and a queue row
    // pointing at a 404 is worse than a shorter queue.
    if (meta === undefined) continue;

    const rows = progress.get(slug) ?? [];
    const mastered = rows.some((row) => statusRank(row.status) >= statusRank('mastered'));
    const best = rows.reduce(
      (acc, row) => (statusRank(row.status) > statusRank(acc) ? row.status : acc),
      'not_started' as ReviewItem['status'],
    );
    const dueAt = reviewDueAt(entry.lastAt, entry.count, mastered);

    items.push({
      slug,
      title: meta.title,
      topic: meta.topic,
      tier: meta.tier,
      status: best,
      lastPassedAt: entry.lastAt,
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
