import {
  LANGUAGES,
  PROBLEM_SORT_KEYS,
  PROGRESS_STATUSES,
  TIERS,
  TOPICS,
  type Language,
  type ProblemSort,
  type ProgressStatus,
  type SortDirection,
  type Tier,
  type Topic,
} from '@devpromax/shared';
import { problemQueryString } from '../../api/client.js';

/**
 * The list's filters, kept in the URL (ROADMAP P4-5).
 *
 * The URL is the state, not a copy of it. That is what makes a filtered list
 * something you can bookmark, reload, or send to yourself - and it is also why
 * the back button works through a session of narrowing down: each change is a
 * navigation, and React Router keeps the history.
 *
 * Every value is checked against the enum it belongs to rather than parsed with
 * the request schema. A hand-edited `?topic=arrayz` should drop that one word
 * and show the rest, not reject the whole query and silently reset filters the
 * user can still see in the address bar.
 */

export interface ProblemFilters {
  topic: Topic[];
  tier: Tier[];
  status: ProgressStatus[];
  q: string;
  language: Language | undefined;
  sort: ProblemSort;
  dir: SortDirection;
}

export const NO_FILTERS: ProblemFilters = {
  topic: [],
  tier: [],
  status: [],
  q: '',
  language: undefined,
  sort: 'default',
  dir: 'asc',
};

function known<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return values.filter((value): value is T => (allowed as readonly string[]).includes(value));
}

function one<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return value !== null && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export function filtersFromSearch(params: URLSearchParams): ProblemFilters {
  return {
    // `getAll` covers the repeated form; splitting on commas covers the form
    // people type by hand, which the server also accepts (`multi()` in shared).
    topic: known(
      params.getAll('topic').flatMap((value) => value.split(',')),
      TOPICS,
    ),
    tier: known(
      params.getAll('tier').flatMap((value) => value.split(',')),
      TIERS,
    ),
    status: known(
      params.getAll('status').flatMap((value) => value.split(',')),
      PROGRESS_STATUSES,
    ),
    q: params.get('q')?.slice(0, 120) ?? '',
    language: one(params.get('language'), LANGUAGES),
    sort: one(params.get('sort'), PROBLEM_SORT_KEYS) ?? 'default',
    dir: one(params.get('dir'), ['asc', 'desc'] as const) ?? 'asc',
  };
}

/** The same serialisation the API client uses, so the URL and the request agree. */
export function searchFromFilters(filters: ProblemFilters): string {
  return problemQueryString({
    topic: filters.topic,
    tier: filters.tier,
    status: filters.status,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.language ? { language: filters.language } : {}),
    sort: filters.sort,
    dir: filters.dir,
  });
}

/**
 * Whether anything is narrowing the list.
 *
 * Sort is excluded on purpose: re-ordering a list is not filtering it, and
 * "Clear all" must not throw away the column the user is sorting by.
 */
export function isFiltered(filters: ProblemFilters): boolean {
  return (
    filters.topic.length > 0 ||
    filters.tier.length > 0 ||
    filters.status.length > 0 ||
    filters.q !== '' ||
    filters.language !== undefined
  );
}

/** Toggling one value of a multi-select filter, preserving the enum's own order. */
export function toggle<T extends string>(current: T[], value: T, allowed: readonly T[]): T[] {
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value];
  return allowed.filter((entry) => next.includes(entry));
}
