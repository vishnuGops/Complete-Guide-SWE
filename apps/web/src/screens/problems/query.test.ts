import { describe, expect, it } from 'vitest';
import { TOPICS } from '@devpromax/shared';
import {
  NO_FILTERS,
  filtersFromSearch,
  isFiltered,
  searchFromFilters,
  toggle,
  type ProblemFilters,
} from './query.js';

/**
 * Filters in the URL (ROADMAP P4-5).
 *
 * The URL is the state, so this is the parser for it - and a parser for
 * user-editable text has to be forgiving in one direction and strict in the
 * other: keep what is valid, drop what is not, and never throw away a whole
 * query because one word in it was misspelled.
 */

describe('filtersFromSearch', () => {
  it('reads the repeated form and the comma form the same way', () => {
    expect(filtersFromSearch(new URLSearchParams('topic=arrays&topic=stack')).topic).toEqual([
      'arrays',
      'stack',
    ]);
    expect(filtersFromSearch(new URLSearchParams('topic=arrays,stack')).topic).toEqual([
      'arrays',
      'stack',
    ]);
  });

  it('drops values that are not in the enum and keeps the rest', () => {
    const filters = filtersFromSearch(new URLSearchParams('topic=arrays,arrayz&tier=Easy'));
    expect(filters.topic).toEqual(['arrays']);
    expect(filters.tier).toEqual(['Easy']);
  });

  it('falls back to the default sort rather than rejecting the query', () => {
    const filters = filtersFromSearch(new URLSearchParams('sort=whatever&dir=sideways&q=sum'));
    expect(filters.sort).toBe('default');
    expect(filters.dir).toBe('asc');
    expect(filters.q).toBe('sum');
  });

  it('reads an empty query as no filters at all', () => {
    expect(filtersFromSearch(new URLSearchParams(''))).toEqual(NO_FILTERS);
  });
});

describe('searchFromFilters', () => {
  it('round-trips', () => {
    const filters: ProblemFilters = {
      topic: ['arrays', 'stack'],
      tier: [],
      status: ['solved'],
      q: 'sum',
      language: 'python',
      sort: 'rating',
      dir: 'desc',
    };
    expect(filtersFromSearch(new URLSearchParams(searchFromFilters(filters)))).toEqual(filters);
  });

  it('leaves the default sort out, so an unfiltered list has a clean URL', () => {
    expect(searchFromFilters(NO_FILTERS)).toBe('');
  });
});

describe('isFiltered', () => {
  it('does not count sorting as filtering', () => {
    // "Clear all" must not throw away the column the user chose to sort by.
    expect(isFiltered({ ...NO_FILTERS, sort: 'rating', dir: 'desc' })).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, tier: ['Hard'] })).toBe(true);
    expect(isFiltered({ ...NO_FILTERS, language: 'java' })).toBe(true);
  });
});

describe('toggle', () => {
  it('adds, removes, and keeps the enum’s own order', () => {
    expect(toggle(['stack'], 'arrays', TOPICS)).toEqual(['arrays', 'stack']);
    expect(toggle(['arrays', 'stack'], 'arrays', TOPICS)).toEqual(['stack']);
  });
});
