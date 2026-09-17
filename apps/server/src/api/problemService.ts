import {
  countByStatus,
  groupCounts,
  LANGUAGES,
  problemStatus,
  statusRank,
  TIERS,
  timeoutFor,
  TOPICS,
  topicOrder,
  type Language,
  type ProblemDetail,
  type ProblemListQuery,
  type ProblemListResponse,
  type ProblemMeta,
  type ProblemProgress,
  type ProblemSummary,
  type ProgressResponse,
  type ProgressStatus,
  type RelatedProblem,
  type TierCount,
  type TopicCount,
} from '@devpromax/shared';
import type { Repositories } from '../db/index.js';
import type { Catalogue } from './catalogue.js';
import { notFound } from './errors.js';

/**
 * Reading the catalogue (ROADMAP P3-1).
 *
 * Everything the list, the filters and the workspace need is assembled here, so
 * the routes stay thin and the interesting rules - how a problem's status is
 * derived, what the editorial gate is, what the counts count - are unit-testable
 * without a server.
 */

export interface ProblemServiceDeps {
  catalogue: Catalogue;
  repos: Repositories;
}

/** Progress rows for every problem, keyed by slug. One query, not one per row. */
function progressBySlug(repos: Repositories): Map<string, ProblemProgress[]> {
  const grouped = new Map<string, ProblemProgress[]>();
  for (const row of repos.progress.list()) {
    const existing = grouped.get(row.slug);
    if (existing) existing.push(row);
    else grouped.set(row.slug, [row]);
  }
  return grouped;
}

function latest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

function earliest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a < b ? a : b;
}

/**
 * One list row.
 *
 * When `language` is given the row describes that language only - status,
 * attempts and dates all come from its row - which is what makes
 * `?status=solved&language=python` mean "solved in Python". Without it the
 * status is the best across languages (D11) and the numbers are the totals.
 */
export function summarise(
  meta: ProblemMeta,
  rows: readonly ProblemProgress[],
  language?: Language,
): ProblemSummary {
  const relevant = language ? rows.filter((row) => row.language === language) : rows;

  const statusByLanguage: Partial<Record<Language, ProgressStatus>> = {};
  for (const row of rows) statusByLanguage[row.language] = row.status;

  return {
    id: meta.id,
    slug: meta.slug,
    title: meta.title,
    topic: meta.topic,
    tier: meta.tier,
    rating: meta.rating,
    order: meta.order,
    patterns: meta.patterns,
    mode: meta.mode,
    status: language
      ? (statusByLanguage[language] ?? 'not_started')
      : problemStatus(rows as ProblemProgress[]),
    statusByLanguage,
    attempts: relevant.reduce((sum, row) => sum + row.attempts, 0),
    lastAttemptedAt: relevant.reduce<string | null>(
      (acc, row) => latest(acc, row.lastAttemptedAt),
      null,
    ),
    solvedAt: relevant.reduce<string | null>((acc, row) => earliest(acc, row.solvedAt), null),
  };
}

function matchesQuery(summary: ProblemSummary, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    summary.title.toLowerCase().includes(needle) ||
    summary.slug.includes(needle) ||
    summary.patterns.some((pattern) => pattern.toLowerCase().includes(needle))
  );
}

/** Rating, then the curriculum path. The order the list has when nobody sorts it. */
function defaultOrder(a: ProblemSummary, b: ProblemSummary): number {
  return (
    a.rating - b.rating ||
    topicOrder(a.topic) - topicOrder(b.topic) ||
    a.order - b.order ||
    a.title.localeCompare(b.title)
  );
}

function compareBy(sort: ProblemListQuery['sort'], a: ProblemSummary, b: ProblemSummary): number {
  switch (sort) {
    case 'title':
      return a.title.localeCompare(b.title);
    case 'topic':
      return topicOrder(a.topic) - topicOrder(b.topic);
    case 'tier':
      return TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier);
    case 'rating':
      return a.rating - b.rating;
    case 'status':
      return statusRank(a.status) - statusRank(b.status);
    case 'lastAttempted':
      // Never-attempted rows sink to the bottom whichever way the column is
      // sorted: they are absent data, not the oldest data.
      if (a.lastAttemptedAt === null && b.lastAttemptedAt === null) return 0;
      if (a.lastAttemptedAt === null) return 1;
      if (b.lastAttemptedAt === null) return -1;
      return a.lastAttemptedAt.localeCompare(b.lastAttemptedAt);
    case 'default':
      return 0;
  }
}

function sortSummaries(
  summaries: ProblemSummary[],
  sort: ProblemListQuery['sort'],
  dir: ProblemListQuery['dir'],
): ProblemSummary[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...summaries].sort((a, b) => {
    // `lastAttempted` resolves its own nulls above, so the sign must not flip
    // them back to the top.
    if (sort === 'lastAttempted' && (a.lastAttemptedAt === null || b.lastAttemptedAt === null)) {
      return compareBy(sort, a, b);
    }
    const primary = compareBy(sort, a, b) * sign;
    return primary !== 0 ? primary : defaultOrder(a, b);
  });
}

export function listProblems(
  query: ProblemListQuery,
  deps: ProblemServiceDeps,
): ProblemListResponse {
  const grouped = progressBySlug(deps.repos);
  const all = deps.catalogue
    .list()
    .map((pkg) => summarise(pkg.meta, grouped.get(pkg.meta.slug) ?? [], query.language));

  const matched = all.filter((summary) => {
    if (query.topic.length > 0 && !query.topic.includes(summary.topic)) return false;
    if (query.tier.length > 0 && !query.tier.includes(summary.tier)) return false;
    if (query.status.length > 0 && !query.status.includes(summary.status)) return false;
    if (query.q !== undefined && query.q !== '' && !matchesQuery(summary, query.q)) return false;
    return true;
  });

  return {
    items: sortSummaries(matched, query.sort, query.dir),
    matched: matched.length,
    total: all.length,
    byStatus: countByStatus(all.map((summary) => summary.status)),
    byTopic: countTopics(all),
  };
}

function countTopics(summaries: readonly ProblemSummary[]): TopicCount[] {
  return TOPICS.filter((topic) => summaries.some((summary) => summary.topic === topic)).map(
    (topic) => ({
      topic,
      ...groupCounts(
        summaries.filter((summary) => summary.topic === topic).map((summary) => summary.status),
      ),
    }),
  );
}

function countTiers(summaries: readonly ProblemSummary[]): TierCount[] {
  return TIERS.filter((tier) => summaries.some((summary) => summary.tier === tier)).map((tier) => ({
    tier,
    ...groupCounts(
      summaries.filter((summary) => summary.tier === tier).map((summary) => summary.status),
    ),
  }));
}

function relatedTo(meta: ProblemMeta, catalogue: Catalogue): RelatedProblem[] {
  // Silently drops a related slug that names nothing: `meta.related` can point
  // at a problem that has not been written yet, and a dangling pointer is the
  // validator's complaint to make, not a reason to fail this request.
  return meta.related.flatMap((slug) => {
    const pkg = catalogue.get(slug);
    if (!pkg) return [];
    return [{ slug, title: pkg.meta.title, tier: pkg.meta.tier, rating: pkg.meta.rating }];
  });
}

export function problemDetail(slug: string, deps: ProblemServiceDeps): ProblemDetail {
  const pkg = deps.catalogue.get(slug);
  if (!pkg) throw notFound(`No problem with slug "${slug}".`);

  const { repos } = deps;
  const rows = repos.progress.listByProblem(slug);
  const summary = summarise(pkg.meta, rows);
  const settings = repos.settings.get();

  // Solved in *any* language unlocks the editorial: the approach is the same
  // approach, and re-hiding it because the user has not also done it in Java
  // would be pedantry rather than a gate.
  const unlocked = statusRank(summary.status) >= statusRank('solved');

  const drafts: ProblemDetail['drafts'] = {};
  for (const draft of repos.drafts.listByProblem(slug)) drafts[draft.language] = draft;

  const timeoutMs: ProblemDetail['timeoutMs'] = {};
  for (const language of LANGUAGES) {
    timeoutMs[language] = Math.round(
      timeoutFor(pkg.meta.limits, language) * settings.judge.timeoutMultiplier,
    );
  }

  return {
    summary,
    statement: pkg.statement,
    entry: pkg.meta.entry,
    expect: pkg.meta.expect,
    comparator: pkg.meta.comparator.kind,
    ...(pkg.meta.targetComplexity ? { targetComplexity: pkg.meta.targetComplexity } : {}),
    version: pkg.meta.version,
    timeoutMs,
    samples: pkg.tests.samples,
    hiddenCount: pkg.tests.hidden.length,
    hints: pkg.hints.hints,
    editorial: unlocked ? pkg.editorial : null,
    editorialUnlocked: unlocked,
    starters: { python: pkg.sources.starterPython, java: pkg.sources.starterJava },
    drafts,
    progress: rows,
    submissionCount: repos.submissions.countByProblem(slug),
    assets: pkg.assets,
    note: repos.notes.get(slug)?.body ?? null,
    related: relatedTo(pkg.meta, deps.catalogue),
  };
}

/**
 * The `/api/progress` payload.
 *
 * Counts are over the catalogue rather than over the progress table: a topic
 * with no attempts has to appear as "0 / 12", and a table of what the user has
 * touched cannot say what they have not.
 */
export function progressOverview(deps: ProblemServiceDeps): ProgressResponse {
  const grouped = progressBySlug(deps.repos);
  const summaries = deps.catalogue
    .list()
    .map((pkg) => summarise(pkg.meta, grouped.get(pkg.meta.slug) ?? []));

  return {
    rows: [...grouped.values()].flat(),
    total: summaries.length,
    byStatus: countByStatus(summaries.map((summary) => summary.status)),
    byTopic: countTopics(summaries),
    byTier: countTiers(summaries),
  };
}

export const __testing = { defaultOrder, sortSummaries };
