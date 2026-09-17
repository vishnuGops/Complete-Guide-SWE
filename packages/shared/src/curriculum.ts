import { z } from 'zod';

/**
 * The 14 curriculum topics in learning-path order (ROADMAP section 4). The array
 * order *is* the curriculum order — the problem list sorts by rating and then by
 * this — so never re-sort it alphabetically.
 */
export const TOPICS = [
  'arrays',
  'hashmap',
  'sorting',
  'binary-search',
  'linked-list',
  'stack',
  'matrix',
  'binary-tree',
  'heap',
  'graph',
  'backtracking',
  'dynamic-programming',
  'bit-manipulation',
  'data-structures',
] as const;

export const topicSchema = z.enum(TOPICS);
export type Topic = z.infer<typeof topicSchema>;

export const TOPIC_LABEL: Record<Topic, string> = {
  arrays: 'Arrays',
  hashmap: 'HashMap',
  sorting: 'Sorting',
  'binary-search': 'Binary Search',
  'linked-list': 'Linked List',
  stack: 'Stack',
  matrix: 'Matrix',
  'binary-tree': 'Binary Tree',
  heap: 'Heap',
  graph: 'Graph',
  backtracking: 'Backtracking',
  'dynamic-programming': 'Dynamic Programming',
  'bit-manipulation': 'Bit Manipulation',
  'data-structures': 'Data Structures',
};

/** Position of a topic in the learning path; used as the secondary list sort key. */
export function topicOrder(topic: Topic): number {
  return TOPICS.indexOf(topic);
}

export const TIERS = ['Easy', 'Medium', 'Hard'] as const;
export const tierSchema = z.enum(TIERS);
export type Tier = z.infer<typeof tierSchema>;

/** Fine-grained difficulty (ROADMAP D10): each tier owns a closed rating band. */
export const TIER_RATING_RANGE: Record<Tier, readonly [number, number]> = {
  Easy: [1, 3],
  Medium: [4, 7],
  Hard: [8, 10],
};

export const ratingSchema = z.int().min(1).max(10);

export function tierForRating(rating: number): Tier | undefined {
  return TIERS.find(
    (tier) => rating >= TIER_RATING_RANGE[tier][0] && rating <= TIER_RATING_RANGE[tier][1],
  );
}
