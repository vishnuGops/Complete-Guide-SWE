import { z } from 'zod';

/**
 * The pattern vocabulary (ROADMAP P6-1).
 *
 * `patterns` used to be free text, and twenty problems were enough to produce
 * "hash map", "hash set" and "frequency map" for one idea, and "two pointers"
 * and "two passes" for two different ones. Free text does not survive two
 * hundred problems: the list page filters on these, the dashboard will group
 * weak spots by them (P7-5), and "the problems that taught me sliding window"
 * is not a question a spelling variant can answer.
 *
 * So: a closed list, grouped by what it is for. Adding to it is a deliberate
 * act - a new entry here, a line in `docs/CURRICULUM.md`, and the reason in
 * the commit - which is the point. A pattern nobody can define is a tag, and
 * tags rot.
 *
 * The names read as an interviewer would say them, because that is where the
 * user meets them: "this is a monotonic stack problem", not "monotonic-stack".
 */

/** How the input is walked. */
const TRAVERSAL = [
  'one pass',
  'two passes',
  'two pointers',
  'fast and slow pointers',
  'sliding window',
  'fixed window',
  'reverse traversal',
  'sweep',
] as const;

/** What is remembered while walking it. */
const BOOKKEEPING = [
  'prefix sum',
  'running total',
  'frequency map',
  'hash map',
  'hash set',
  'counting',
  'complement lookup',
  'canonical key',
  'grouping',
  'invariant',
  'in-place',
  'mutated argument',
] as const;

/** Order, and what it buys. */
const ORDERING = [
  'sorted input',
  'custom sort',
  'counting sort',
  'tie breaking',
  'intervals',
  'stable partition',
  'cyclic shift',
  'reversal',
] as const;

/** Search. */
const SEARCH = [
  'binary search',
  'boundary binary search',
  'binary search on the answer',
  'lower bound',
  'rotated array',
  'feasibility check',
  'greedy',
] as const;

/** Linear structures. */
const LINEAR = [
  'stack',
  'monotonic stack',
  'monotonic deque',
  'queue',
  'dummy head',
  'linked list reversal',
  'merge',
  'matching pairs',
  'next greater element',
  'amortised O(1)',
  'amortised scan',
  'auxiliary stack',
] as const;

/** Trees, heaps and graphs. */
const HIERARCHICAL = [
  'tree traversal',
  'depth-first search',
  'breadth-first search',
  'binary search tree',
  'lowest common ancestor',
  'tree construction',
  'serialisation',
  'heap',
  'top k',
  'two heaps',
  'k-way merge',
  'union find',
  'topological sort',
  'shortest path',
  'bipartite check',
  'grid traversal',
  'flood fill',
] as const;

/** Enumeration and optimisation. */
const SEARCH_SPACE = [
  'backtracking',
  'pruning',
  'permutations',
  'combinations',
  'subsets',
  'memoisation',
  'tabulation',
  'one-dimensional dp',
  'two-dimensional dp',
  'knapsack',
  'longest common subsequence',
  'longest increasing subsequence',
  'edit distance',
  'dp on grids',
  'bitmask dp',
  'state machine',
] as const;

/** Bit-level work. */
const BITS = ['xor trick', 'bit counting', 'bit masking', 'power of two'] as const;

/** Shapes rather than techniques. */
const SHAPE = [
  'design',
  'two maps',
  'strings',
  'matrix',
  'spiral order',
  'rotation',
  'trie',
  'segment tree',
  'fenwick tree',
  'cache eviction',
  'randomisation',
] as const;

export const PATTERNS = [
  ...TRAVERSAL,
  ...BOOKKEEPING,
  ...ORDERING,
  ...SEARCH,
  ...LINEAR,
  ...HIERARCHICAL,
  ...SEARCH_SPACE,
  ...BITS,
  ...SHAPE,
] as const;

export const patternSchema = z.enum(PATTERNS);
export type Pattern = z.infer<typeof patternSchema>;

/** The groups, for the curriculum document and for grouping filters later. */
export const PATTERN_GROUPS: Record<string, readonly Pattern[]> = {
  'How the input is walked': TRAVERSAL,
  'What is remembered': BOOKKEEPING,
  'Order, and what it buys': ORDERING,
  Search: SEARCH,
  'Linear structures': LINEAR,
  'Trees, heaps and graphs': HIERARCHICAL,
  'Enumeration and optimisation': SEARCH_SPACE,
  'Bit-level work': BITS,
  Shapes: SHAPE,
};
