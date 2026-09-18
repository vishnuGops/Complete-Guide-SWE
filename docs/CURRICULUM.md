# Curriculum

The content backlog for M3 (ROADMAP P6-1, feeding P6-2 … P6-6). Fourteen topics,
about two hundred problems, each one planned before it is written so that the
catalogue is a path rather than a pile.

Read `AUTHORING.md` before writing any of them, and `PROBLEM_FORMAT.md` for what
a package contains.

## 1. How to read a topic table

| Column        | Means                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| `#`           | `order` in `meta.json`. Unique within a topic; the validator enforces it. |
| Slug          | The directory name, and the URL. Never renamed after release.             |
| Title         | Original wording. Never a LeetCode title.                                 |
| Tier / rating | Easy 1–3, Medium 4–7, Hard 8–10. The band is enforced by the schema.      |
| Mode          | `function` unless the problem is a design problem, which is `operations`. |
| Patterns      | From the closed vocabulary in `packages/shared/src/patterns.ts`.          |
| Flags         | See below.                                                                |

Three flags, each of which changes what has to exist before the problem can be
written:

- **trap** — the target complexity beats the obvious approach, so the problem
  needs a hidden test at the stated maximum that the obvious approach cannot
  finish (D21). The editorial says which approach times out; that claim must be
  true.
- **node** — the signature uses `ListNode` or `TreeNode`. P2-12 proved both
  decode in both languages; these are the problems that rely on it.
- **checker** — no single right answer, so the problem ships a `checker.ts`
  (D6) rather than an expected value.

Two heap rows are gone, both because the problem was already in the catalogue
under another name. `meeting-rooms-heap` is `meeting-room-count` (Sorting 3) and
`median-maintenance` is `window-median-stream` (Arrays 12) - the same question,
the same answer, the same editorial. The rule in section 3 applies: a problem
that teaches nothing the one before it did not is worse than no problem. Heap is
10 problems (P6-4).

`k-most-frequent` loses its trap flag. Its obvious answer - count, then sort the
distinct values - is `O(m log m)` with `m` at most 10^5, which finishes easily;
there is no input size at which it does not. The heap is better asymptotically
and the bucket answer is better still, and the editorial says so without
pretending the sort times out (D21).

`serialise-tree` is a `function` problem rather than an `operations` one. A codec
class would have to take a tree as an operation argument, and operations mode
hands arguments to the method untouched - Python would receive a raw list where
Java's reflection builds a real `TreeNode`, so the two languages would diverge on
every case. Instead it takes a tree written in pre-order form and returns it in
level-order form, which needs a genuine reader and a genuine writer and is the
same exercise (P6-4).

`is-search-tree` loses its trap flag: what it traps is _correctness_ - a check
that compares each node only with its two children accepts a tree that is not a
search tree - and no input size defeats the obvious approach, which is already
linear. Its second sample is the trap, and the statement says so (P6-4, D21).

`widest-level` measures the most nodes on a level rather than the width
including the gaps between them. The gap-counting version's answer grows as
2^depth and a tree of 2000 nodes can be 2000 deep, so the answer would not fit
the wire's integer bound of 2^53 (D22). Rating lowered to 5 with the change.

`single-among-triples` and `two-lonely-numbers` lose their trap flags for the
same reason as the space traps below: their obvious answer is a frequency map,
which is linear in time and fails only the `O(1)` space requirement. No input
size defeats it, so the statements ask for the space bound and claim no timeout
(P6-5, D21).

`subsets-by-mask` needs no checker. Enumerating the subsets by counting masks
gives one definite order, so the statement asks for that order and the answer is
unique - which is also what makes it a different problem from `all-subsets`
rather than the same one with a different technique.

Two flagged traps are **space** traps, not time traps: `zero-the-cross` and
`shift-right-in-place` beat the obvious approach on memory, and no input size
demonstrates that. Their statements name the space target and make no claim
about a timeout, and their maximum-size cases exist to cover the constraint
rather than to defeat anything (P6-0, P6-3, D21).

`median-of-two-sorted` was planned as a trap and is not one: merging two sorted
series is `O(n + m)`, which finishes at any size whose `tests.json` is a
reasonable weight, so no honest maximum-size case defeats the obvious approach.
Its statement names the `O(log(min(n, m)))` target instead of claiming a timeout
that would not happen (P6-2, D21).

Ratings are a first estimate. Calibration against solving time is P6-7's job,
and a rating that turns out wrong is a one-line change plus a version bump.

## 2. Pattern vocabulary

`patterns` is a closed enum (`packages/shared/src/patterns.ts`), grouped as:

- **How the input is walked** — one pass, two passes, two pointers, fast and
  slow pointers, sliding window, fixed window, reverse traversal, sweep.
- **What is remembered** — prefix sum, running total, frequency map, hash map,
  hash set, counting, complement lookup, canonical key, grouping, invariant,
  in-place, mutated argument.
- **Order, and what it buys** — sorted input, custom sort, counting sort, tie
  breaking, intervals, stable partition, cyclic shift, reversal.
- **Search** — binary search, boundary binary search, binary search on the
  answer, lower bound, rotated array, feasibility check, greedy.
- **Linear structures** — stack, monotonic stack, monotonic deque, queue, dummy
  head, linked list reversal, merge, matching pairs, next greater element,
  amortised O(1), amortised scan, auxiliary stack.
- **Trees, heaps and graphs** — tree traversal, depth-first search, breadth-first
  search, binary search tree, lowest common ancestor, tree construction,
  serialisation, heap, top k, two heaps, k-way merge, union find, topological
  sort, shortest path, bipartite check, grid traversal, flood fill.
- **Enumeration and optimisation** — backtracking, pruning, permutations,
  combinations, subsets, memoisation, tabulation, one-dimensional dp,
  two-dimensional dp, knapsack, longest common subsequence, longest increasing
  subsequence, edit distance, dp on grids, bitmask dp, state machine.
- **Bit-level work** — xor trick, bit counting, bit masking, power of two.
- **Shapes** — design, two maps, strings, matrix, spiral order, rotation, trie,
  segment tree, fenwick tree, cache eviction, randomisation.

Adding a pattern is a deliberate act: an entry in that file, a line here, and
the reason in the commit message. A pattern nobody can define is a tag, and tags
rot.

## 3. Budget

Measured on the twenty seed problems: **30–45 minutes each**, of which the
pipeline is a few minutes and the rest is writing the statement, the hints
ladder and the editorial, then reading them again as a stranger would. Two
hundred problems is therefore a hundred hours of work that cannot be automated
away — the generator writes the tests, not the teaching.

Batches are sized so that each is a shippable increment: the catalogue is
useful at the end of Batch A and merely larger after each one that follows.

---

## 4. Batch A — Arrays, HashMap, Sorting, Binary Search

The foundation, and the batch a new user meets first. Twenty of these are the
seed (marked **seeded**); the rest extend each topic to a full path.

### Arrays (`arrays`) — 14 problems

Patterns to cover: one pass, two pointers, sliding window (fixed and variable),
prefix sum, in-place rearrangement, intervals as a first taste.

| #   | Slug                       | Title                     | Tier   | Rating | Mode     | Patterns                                       | Flags            |
| --- | -------------------------- | ------------------------- | ------ | ------ | -------- | ---------------------------------------------- | ---------------- |
| 0   | `pair-sum-index`           | Pair Sum Index            | Easy   | 2      | function | hash map, complement lookup, one pass          | trap, **seeded** |
| 1   | `balance-point`            | Balance Point             | Easy   | 2      | function | prefix sum, running total, one pass            | **seeded**       |
| 2   | `even-odd-partition`       | Even Readings First       | Easy   | 3      | function | mutated argument, stable partition, two passes | **seeded**       |
| 3   | `window-average-peak`      | Peak Window Start         | Easy   | 3      | function | sliding window, fixed window, running total    | **seeded**       |
| 4   | `running-maximum`          | Highest So Far            | Easy   | 2      | function | one pass, running total                        |                  |
| 5   | `zero-gravity`             | Sink The Zeroes           | Easy   | 3      | function | in-place, mutated argument, two pointers       |                  |
| 6   | `shift-right-in-place`     | Shift Right In Place      | Medium | 4      | function | in-place, reversal, cyclic shift               | **seeded**       |
| 7   | `pair-sum-under-limit`     | Pairs Under The Limit     | Medium | 4      | function | two pointers, sorted input, counting           | **seeded**       |
| 8   | `longest-distinct-stretch` | Longest Limited Stretch   | Medium | 5      | function | sliding window, frequency map, two pointers    | **seeded**       |
| 9   | `best-single-trade`        | Best Single Trade         | Medium | 4      | function | one pass, running total                        |                  |
| 10  | `largest-run-sum`          | Largest Run Sum           | Medium | 5      | function | one pass, running total, invariant             | trap             |
| 11  | `product-except-self`      | Everything But Me         | Medium | 6      | function | prefix sum, two passes, in-place               | trap             |
| 12  | `window-median-stream`     | Median Of The Last K      | Hard   | 8      | function | sliding window, two heaps                      | trap             |
| 13  | `min-window-cover`         | Shortest Covering Stretch | Hard   | 8      | function | sliding window, frequency map, two pointers    | trap             |

### HashMap (`hashmap`) — 11 problems

Patterns to cover: frequency maps, canonical keys, set membership, complement
lookups, and the first design problem.

| #   | Slug                    | Title                             | Tier   | Rating | Mode       | Patterns                               | Flags            |
| --- | ----------------------- | --------------------------------- | ------ | ------ | ---------- | -------------------------------------- | ---------------- |
| 0   | `first-unique-symbol`   | First Symbol That Stands Alone    | Easy   | 2      | function   | frequency map, two passes, strings     | **seeded**       |
| 1   | `same-letters`          | Built From The Same Letters       | Easy   | 2      | function   | frequency map, canonical key, strings  |                  |
| 2   | `anagram-groups`        | Words Built From The Same Letters | Medium | 5      | function   | frequency map, grouping, canonical key | **seeded**       |
| 3   | `pair-difference-count` | Value Pairs A Fixed Gap Apart     | Medium | 4      | function   | hash set, complement lookup, counting  | **seeded**       |
| 4   | `sequence-run-length`   | Longest Consecutive Run           | Medium | 5      | function   | hash set, amortised scan               | trap, **seeded** |
| 5   | `tag-index`             | Tag Index                         | Medium | 5      | operations | design, two maps, invariant            | **seeded**       |
| 6   | `repeat-within-window`  | Repeat Within Reach               | Easy   | 3      | function   | hash map, sliding window               |                  |
| 7   | `zero-sum-stretch`      | Stretch That Cancels Out          | Medium | 6      | function   | prefix sum, hash map, counting         | trap             |
| 8   | `first-missing-count`   | The Smallest Missing Count        | Medium | 6      | function   | hash set, counting, in-place           | trap             |
| 9   | `word-pattern-match`    | Same Shape, Different Words       | Medium | 5      | function   | two maps, canonical key, strings       |                  |
| 10  | `sparse-vector-dot`     | Dot Product Of Sparse Readings    | Medium | 5      | operations | design, hash map, two pointers         |                  |

### Sorting (`sorting`) — 10 problems

Patterns to cover: sorting as a preprocessing step, custom comparators, tie
breaking, intervals, counting sort, and the cases where sorting is the wrong
answer.

| #   | Slug                        | Title                     | Tier   | Rating | Mode     | Patterns                                 | Flags      |
| --- | --------------------------- | ------------------------- | ------ | ------ | -------- | ---------------------------------------- | ---------- |
| 0   | `frequency-order`           | Order By How Often        | Medium | 4      | function | frequency map, custom sort, tie breaking | **seeded** |
| 1   | `merge-overlapping-windows` | Merge Maintenance Windows | Medium | 5      | function | intervals, sorted input, sweep           | **seeded** |
| 2   | `sort-three-colours`        | Three Kinds Of Reading    | Medium | 5      | function | in-place, two pointers, counting sort    |            |
| 3   | `meeting-room-count`        | Rooms At Once             | Medium | 6      | function | intervals, sweep, heap                   | trap       |
| 4   | `insert-one-window`         | Fit One More Window       | Medium | 5      | function | intervals, one pass                      |            |
| 5   | `kth-largest-value`         | The K-th Largest Reading  | Medium | 5      | function | top k, heap                              | trap       |
| 6   | `closest-k-values`          | The K Closest Readings    | Medium | 6      | function | top k, heap, two pointers                |            |
| 7   | `largest-joined-number`     | Largest Number Made Of    | Medium | 6      | function | custom sort, tie breaking, strings       |            |
| 8   | `sort-by-parity-stable`     | Even Ones First, In Order | Easy   | 3      | function | stable partition, custom sort            |            |
| 9   | `minimum-swaps-sorted`      | Fewest Swaps To Sorted    | Hard   | 8      | function | sorted input, invariant, counting        | trap       |

### Binary Search (`binary-search`) — 10 problems

Patterns to cover: the boundary form (the only form worth memorising), binary
search on the answer, and rotated input.

| #   | Slug                   | Title                      | Tier   | Rating | Mode     | Patterns                                               | Flags            |
| --- | ---------------------- | -------------------------- | ------ | ------ | -------- | ------------------------------------------------------ | ---------------- |
| 0   | `first-not-below`      | First Reading Not Below    | Easy   | 3      | function | boundary binary search, lower bound, sorted input      | **seeded**       |
| 1   | `rotated-lookup`       | Lookup In A Rotated Series | Medium | 6      | function | binary search, rotated array, invariant                | **seeded**       |
| 2   | `min-load-capacity`    | Smallest Workable Capacity | Medium | 6      | function | binary search on the answer, feasibility check, greedy | trap, **seeded** |
| 3   | `insert-position`      | Where It Would Go          | Easy   | 2      | function | boundary binary search, lower bound                    |                  |
| 4   | `first-and-last-seen`  | First And Last Sighting    | Medium | 5      | function | boundary binary search, sorted input                   |                  |
| 5   | `peak-reading`         | A Local Peak               | Medium | 5      | function | binary search, invariant                               |                  |
| 6   | `rotation-point`       | Where The Series Turns     | Medium | 5      | function | binary search, rotated array                           |                  |
| 7   | `split-into-k-parts`   | Fairest Split Into K       | Hard   | 8      | function | binary search on the answer, feasibility check         | trap             |
| 8   | `square-root-floor`    | Whole Square Root          | Easy   | 3      | function | binary search on the answer                            |                  |
| 9   | `median-of-two-sorted` | Median Of Two Series       | Hard   | 9      | function | binary search, sorted input, invariant                 |                  |

---

## 5. Batch B — Linked List, Stack, Matrix

The first batch that needs `ListNode`, which is why P2-12 came before it.

### Linked List (`linked-list`) — 13 problems

Patterns to cover: the dummy head, in-place reversal, fast and slow pointers,
and merging. Every problem here is **node**-flagged.

| #   | Slug                  | Title                      | Tier   | Rating | Mode     | Patterns                                            | Flags      |
| --- | --------------------- | -------------------------- | ------ | ------ | -------- | --------------------------------------------------- | ---------- |
| 0   | `reverse-chain`       | Reverse The Chain          | Easy   | 3      | function | linked list reversal, one pass                      | node       |
| 1   | `middle-link`         | The Middle Link            | Easy   | 2      | function | fast and slow pointers                              | node       |
| 2   | `merge-two-chains`    | Merge Two Ordered Chains   | Easy   | 3      | function | merge, dummy head, sorted input                     | node       |
| 3   | `drop-nth-from-end`   | Drop The N-th From The End | Medium | 4      | function | fast and slow pointers, dummy head                  | node       |
| 4   | `chain-has-cycle`     | Does The Chain Loop        | Medium | 4      | function | fast and slow pointers, invariant                   | node       |
| 5   | `cycle-entry`         | Where The Loop Begins      | Medium | 6      | function | fast and slow pointers, invariant                   | node, trap |
| 6   | `remove-duplicates`   | Collapse Repeated Links    | Easy   | 3      | function | one pass, dummy head                                | node       |
| 7   | `partition-around`    | Split The Chain Around     | Medium | 5      | function | dummy head, stable partition                        | node       |
| 8   | `add-two-numbers`     | Add Two Digit Chains       | Medium | 5      | function | one pass, dummy head                                | node       |
| 9   | `reorder-chain`       | Fold The Chain             | Medium | 6      | function | fast and slow pointers, linked list reversal, merge | node       |
| 10  | `is-palindrome-chain` | Reads The Same Both Ways   | Medium | 5      | function | fast and slow pointers, linked list reversal        | node       |
| 11  | `merge-k-chains`      | Merge K Ordered Chains     | Hard   | 8      | function | k-way merge, heap, merge                            | node, trap |
| 12  | `reverse-in-groups`   | Reverse Every K Links      | Hard   | 8      | function | linked list reversal, dummy head                    | node       |

`chain-has-cycle` and `cycle-entry` were blocked until P2-15 (2026-09-18), which
added a cycle argument the harness consumes while building the chain: the test
carries `[[3, 2, 0, -4], 1]` and the solution is handed a head, not an index.
Both are written.

### Stack (`stack`) — 12 problems

Patterns to cover: matching, the monotonic stack, and stacks as the shape of a
design problem.

| #   | Slug                 | Title                   | Tier   | Rating | Mode       | Patterns                                        | Flags      |
| --- | -------------------- | ----------------------- | ------ | ------ | ---------- | ----------------------------------------------- | ---------- |
| 0   | `bracket-balance`    | Balanced Brackets       | Easy   | 2      | function   | stack, matching pairs, strings                  | **seeded** |
| 1   | `min-value-stack`    | Min Value Stack         | Medium | 4      | operations | design, auxiliary stack, amortised O(1)         | **seeded** |
| 2   | `days-until-warmer`  | Days Until Warmer       | Medium | 5      | function   | monotonic stack, next greater element, one pass | **seeded** |
| 3   | `evaluate-postfix`   | Evaluate A Postfix Line | Medium | 4      | function   | stack, strings                                  |            |
| 4   | `simplify-path`      | Tidy The Path           | Medium | 5      | function   | stack, strings                                  |            |
| 5   | `queue-from-stacks`  | A Queue Made Of Stacks  | Medium | 5      | operations | design, queue, amortised O(1)                   |            |
| 6   | `decode-repeated`    | Expand The Shorthand    | Medium | 6      | function   | stack, strings                                  |            |
| 7   | `next-greater-cycle` | Next Greater, Wrapping  | Medium | 6      | function   | monotonic stack, next greater element           |            |
| 8   | `largest-rectangle`  | Widest Solid Block      | Hard   | 9      | function   | monotonic stack, invariant                      | trap       |
| 9   | `trap-the-rain`      | Water Held Between      | Hard   | 8      | function   | monotonic stack, two pointers                   | trap       |
| 10  | `remove-k-digits`    | Smallest After Removing | Medium | 6      | function   | monotonic stack, greedy, strings                |            |
| 11  | `browser-history`    | Back, Forward, Visit    | Medium | 5      | operations | design, stack                                   |            |

### Matrix (`matrix`) — 11 problems

Patterns to cover: traversal orders, in-place transforms, and the grid as a
graph — which is where BFS and DFS are introduced.

| #   | Slug                   | Title                      | Tier   | Rating | Mode     | Patterns                                       | Flags |
| --- | ---------------------- | -------------------------- | ------ | ------ | -------- | ---------------------------------------------- | ----- |
| 0   | `spiral-reading`       | Read It In A Spiral        | Medium | 5      | function | matrix, spiral order                           |       |
| 1   | `rotate-grid`          | Turn The Grid              | Medium | 5      | function | matrix, rotation, in-place, mutated argument   |       |
| 2   | `zero-the-cross`       | Blank The Row And Column   | Medium | 5      | function | matrix, in-place, mutated argument             | trap  |
| 3   | `search-sorted-grid`   | Find It In A Sorted Grid   | Medium | 5      | function | matrix, binary search, invariant               |       |
| 4   | `count-islands`        | How Many Islands           | Medium | 6      | function | grid traversal, flood fill, depth-first search |       |
| 5   | `shortest-grid-path`   | Fewest Steps Across        | Medium | 6      | function | grid traversal, breadth-first search           |       |
| 6   | `rotting-spread`       | How Long Until All Spoil   | Medium | 6      | function | grid traversal, breadth-first search           |       |
| 7   | `surrounded-regions`   | Regions With No Way Out    | Medium | 6      | function | grid traversal, flood fill, mutated argument   |       |
| 8   | `word-in-grid`         | Find The Word              | Medium | 7      | function | grid traversal, backtracking, pruning          | trap  |
| 9   | `largest-island-after` | Largest Island If You Fill | Hard   | 9      | function | grid traversal, union find, flood fill         | trap  |
| 10  | `diagonal-reading`     | Read The Diagonals         | Easy   | 3      | function | matrix                                         |       |

---

## 6. Batch C — Binary Tree, Heap, Graph

Everything here needs `TreeNode` or an adjacency shape; **node**-flagged rows
rely on P2-12's decoding.

### Binary Tree (`binary-tree`) — 16 problems

Patterns to cover: the three traversals and when each is the natural one, BST
invariants, construction from traversals, and serialisation.

| #   | Slug                     | Title                         | Tier   | Rating | Mode     | Patterns                                         | Flags      |
| --- | ------------------------ | ----------------------------- | ------ | ------ | -------- | ------------------------------------------------ | ---------- |
| 0   | `tree-depth`             | How Deep It Goes              | Easy   | 2      | function | tree traversal, depth-first search               | node       |
| 1   | `same-shape-trees`       | The Same Tree Twice           | Easy   | 2      | function | tree traversal, depth-first search               | node       |
| 2   | `mirror-tree`            | Its Own Reflection            | Easy   | 3      | function | tree traversal, depth-first search               | node       |
| 3   | `level-order-reading`    | Level By Level                | Medium | 4      | function | tree traversal, breadth-first search             | node       |
| 4   | `right-hand-view`        | Seen From The Right           | Medium | 5      | function | tree traversal, breadth-first search             | node       |
| 5   | `path-sum-exists`        | Is There A Path That Sums     | Easy   | 3      | function | tree traversal, depth-first search               | node       |
| 6   | `all-paths-summing`      | Every Path That Sums          | Medium | 5      | function | tree traversal, depth-first search, backtracking | node       |
| 7   | `is-search-tree`         | Is It A Search Tree           | Medium | 5      | function | binary search tree, invariant                    | node       |
| 8   | `kth-smallest-in-bst`    | The K-th Smallest In A BST    | Medium | 5      | function | binary search tree, tree traversal               | node       |
| 9   | `lowest-shared-ancestor` | Their Nearest Shared Ancestor | Medium | 6      | function | lowest common ancestor, depth-first search       | node       |
| 10  | `build-from-traversals`  | Rebuild From Two Readings     | Medium | 7      | function | tree construction, hash map                      | node, trap |
| 11  | `serialise-tree`         | Write It Down And Back        | Hard   | 8      | function | serialisation, tree traversal                    | node       |
| 12  | `widest-level`           | The Widest Level              | Medium | 5      | function | breadth-first search, tree traversal             | node       |
| 13  | `flatten-to-chain`       | Flatten Into A Chain          | Medium | 6      | function | tree traversal, in-place, mutated argument       | node       |
| 14  | `max-path-sum`           | Best Path Through             | Hard   | 9      | function | tree traversal, depth-first search, invariant    | node, trap |
| 15  | `count-good-nodes`       | Nodes Nothing Blocks          | Medium | 4      | function | tree traversal, depth-first search               | node       |

### Heap (`heap`) — 10 problems

Patterns to cover: top-k, the two-heap median trick, k-way merges, and streams —
which is where `operations` mode earns its place a second time.

| #   | Slug                  | Title                       | Tier   | Rating | Mode       | Patterns                          | Flags |
| --- | --------------------- | --------------------------- | ------ | ------ | ---------- | --------------------------------- | ----- |
| 0   | `kth-largest-stream`  | K-th Largest, As It Arrives | Easy   | 3      | operations | design, heap, top k               |       |
| 1   | `k-most-frequent`     | The K Most Common           | Medium | 5      | function   | frequency map, heap, top k        |       |
| 2   | `k-closest-to-origin` | The K Nearest Points        | Medium | 5      | function   | heap, top k                       |       |
| 3   | `running-median`      | The Median So Far           | Hard   | 8      | operations | design, two heaps                 | trap  |
| 4   | `merge-k-series`      | Merge K Ordered Series      | Hard   | 8      | function   | k-way merge, heap                 | trap  |
| 5   | `last-stone-standing` | What Is Left Of The Stones  | Easy   | 3      | function   | heap                              |       |
| 6   | `task-cooldown`       | Tasks With A Cooldown       | Medium | 7      | function   | heap, greedy, counting            | trap  |
| 7   | `cheapest-k-sums`     | K Cheapest Pairings         | Medium | 7      | function   | heap, k-way merge                 | trap  |
| 8   | `reorganise-string`   | No Two The Same In A Row    | Medium | 6      | function   | heap, frequency map, greedy       |       |
| 9   | `smallest-range-k`    | Narrowest Range Covering K  | Hard   | 9      | function   | heap, k-way merge, sliding window | trap  |

### Graph (`graph`) — 13 problems

Patterns to cover: both searches, cycle detection, topological order, union
find, weighted shortest paths, and bipartiteness.

**`clone-the-graph` is dropped** (P2-15, 2026-09-18), which is why this topic is
13 rather than 14. A graph crosses the wire as an edge list plus a vertex count,
so a solution never holds a node to copy, and the answer comes back as an edge
list where a genuine clone and the argument itself are the same bytes: returning
the input passes. P2-15 made _construction_ expressible - a chain the harness
closes into a cycle - and deliberately stopped short of identity, because
telling a copy from an original would need a node type in the reflection table
and an identity assertion inside both harnesses, a fourth `expect` mode serving
one problem. The skill it teaches, a traversal carrying a map from old to new,
is covered by the tree problems and by `count-components`.

| #   | Slug                    | Title                       | Tier   | Rating | Mode       | Patterns                                 | Flags |
| --- | ----------------------- | --------------------------- | ------ | ------ | ---------- | ---------------------------------------- | ----- |
| 0   | `count-components`      | How Many Separate Groups    | Medium | 4      | function   | depth-first search, union find           |       |
| 1   | `path-exists`           | Can You Get There           | Easy   | 3      | function   | breadth-first search, depth-first search |       |
| 2   | `course-order`          | An Order That Works         | Medium | 5      | function   | topological sort, depth-first search     | trap  |
| 3   | `detect-cycle-directed` | Does It Loop Back           | Medium | 5      | function   | depth-first search, invariant            |       |
| 4   | `two-colour-graph`      | Two Colours, No Clashes     | Medium | 4      | function   | bipartite check, breadth-first search    |       |
| 5   | `cheapest-route`        | Cheapest Route              | Medium | 6      | function   | shortest path, heap                      | trap  |
| 6   | `network-delay`         | When The Last One Hears     | Medium | 6      | function   | shortest path, heap                      | trap  |
| 7   | `redundant-link`        | The Link That Closes A Loop | Medium | 5      | function   | union find                               |       |
| 8   | `accounts-merge`        | One Person, Many Addresses  | Medium | 6      | function   | union find, grouping                     |       |
| 9   | `word-ladder`           | One Letter At A Time        | Hard   | 7      | function   | breadth-first search, hash set           | trap  |
| 10  | `alien-order`           | The Order Of A New Alphabet | Hard   | 8      | function   | topological sort, strings                | trap  |
| 11  | `minimum-spanning-cost` | Cheapest Way To Connect     | Hard   | 7      | function   | union find, sorted input, greedy         | trap  |
| 12  | `graph-union-find`      | Connections, As They Come   | Medium | 5      | operations | design, union find, amortised O(1)       |       |

---

## 7. Batch D — Backtracking, DP, Bit Manipulation

### Backtracking (`backtracking`) — 12 problems

Patterns to cover: the shape of the recursion, pruning, and the difference
between permutations, combinations and subsets. Several are **checker**
problems, because the order of the answers does not matter.

| #   | Slug                     | Title                     | Tier   | Rating | Mode     | Patterns                                | Flags         |
| --- | ------------------------ | ------------------------- | ------ | ------ | -------- | --------------------------------------- | ------------- |
| 0   | `all-subsets`            | Every Subset              | Medium | 4      | function | subsets, backtracking                   | checker       |
| 1   | `all-permutations`       | Every Ordering            | Medium | 5      | function | permutations, backtracking              | checker       |
| 2   | `combinations-of-k`      | Every Choice Of K         | Medium | 5      | function | combinations, backtracking              | checker       |
| 3   | `sum-combinations`       | Ways To Reach The Total   | Medium | 6      | function | combinations, backtracking, pruning     | checker       |
| 4   | `subsets-with-repeats`   | Subsets Without Repeats   | Medium | 6      | function | subsets, backtracking, sorted input     | checker       |
| 5   | `letter-arrangements`    | Letters From A Keypad     | Medium | 5      | function | combinations, backtracking, strings     | checker       |
| 6   | `split-into-palindromes` | Cut Into Palindromes      | Medium | 7      | function | backtracking, pruning, strings          | checker       |
| 7   | `n-queens-count`         | How Many Queen Placements | Hard   | 8      | function | backtracking, pruning, bit masking      | trap          |
| 8   | `solve-the-grid`         | Fill The Number Grid      | Hard   | 9      | function | backtracking, pruning, mutated argument | trap          |
| 9   | `restore-addresses`      | Where The Dots Go         | Medium | 7      | function | backtracking, strings, pruning          | checker       |
| 10  | `generate-brackets`      | Every Balanced Fragment   | Medium | 6      | function | backtracking, matching pairs            | checker       |
| 11  | `word-break-all`         | Every Way To Read It      | Hard   | 8      | function | backtracking, memoisation, strings      | checker, trap |

### Dynamic Programming (`dynamic-programming`) — 18 problems

Patterns to cover: memoisation before tabulation, one dimension before two,
and the classics that every interview draws from.

| #   | Slug                     | Title                     | Tier   | Rating | Mode     | Patterns                                       | Flags |
| --- | ------------------------ | ------------------------- | ------ | ------ | -------- | ---------------------------------------------- | ----- |
| 0   | `stair-ways`             | Ways Up The Stairs        | Easy   | 3      | function | one-dimensional dp, tabulation                 |       |
| 1   | `house-robber`           | Skip A House              | Medium | 4      | function | one-dimensional dp, state machine              |       |
| 2   | `coin-ways`              | Ways To Make The Amount   | Medium | 5      | function | one-dimensional dp, knapsack                   | trap  |
| 3   | `fewest-coins`           | Fewest Coins              | Medium | 5      | function | one-dimensional dp, tabulation                 | trap  |
| 4   | `longest-rising-run`     | Longest Rising Run        | Medium | 6      | function | longest increasing subsequence, binary search  | trap  |
| 5   | `word-break-possible`    | Can It Be Read At All     | Medium | 6      | function | one-dimensional dp, memoisation, strings       |       |
| 6   | `grid-paths`             | Ways Across The Grid      | Medium | 5      | function | dp on grids, two-dimensional dp                |       |
| 7   | `cheapest-grid-path`     | Cheapest Way Across       | Medium | 5      | function | dp on grids, two-dimensional dp                |       |
| 8   | `shared-subsequence`     | Longest Shared Reading    | Medium | 7      | function | longest common subsequence, two-dimensional dp | trap  |
| 9   | `edit-steps`             | Fewest Edits              | Hard   | 8      | function | edit distance, two-dimensional dp              | trap  |
| 10  | `partition-equal-halves` | Split Into Equal Halves   | Medium | 6      | function | knapsack, one-dimensional dp                   | trap  |
| 11  | `bounded-knapsack`       | What Fits In The Bag      | Medium | 7      | function | knapsack, two-dimensional dp                   | trap  |
| 12  | `longest-palindrome-run` | Longest Palindrome Inside | Medium | 7      | function | two-dimensional dp, strings                    | trap  |
| 13  | `decode-ways`            | Ways To Read The Digits   | Medium | 6      | function | one-dimensional dp, state machine              |       |
| 14  | `stock-with-cooldown`    | Trades With A Cooldown    | Medium | 7      | function | state machine, one-dimensional dp              |       |
| 15  | `burst-the-balloons`     | Best Order To Burst       | Hard   | 9      | function | two-dimensional dp, memoisation                | trap  |
| 16  | `travel-all-cities`      | Shortest Round Trip       | Hard   | 10     | function | bitmask dp, memoisation                        | trap  |
| 17  | `regex-match`            | Does The Pattern Match    | Hard   | 9      | function | two-dimensional dp, strings, state machine     | trap  |

### Bit Manipulation (`bit-manipulation`) — 9 problems

Patterns to cover: XOR as cancellation, counting bits, masks as sets.

| #   | Slug                   | Title                     | Tier   | Rating | Mode     | Patterns                         | Flags |
| --- | ---------------------- | ------------------------- | ------ | ------ | -------- | -------------------------------- | ----- |
| 0   | `the-lonely-number`    | The One That Appears Once | Easy   | 2      | function | xor trick, one pass              |       |
| 1   | `count-the-ones`       | How Many Bits Are Set     | Easy   | 2      | function | bit counting                     |       |
| 2   | `bits-up-to-n`         | Set Bits Up To N          | Easy   | 3      | function | bit counting, one-dimensional dp |       |
| 3   | `missing-from-range`   | The Missing Number        | Easy   | 3      | function | xor trick, counting              |       |
| 4   | `single-among-triples` | The One Among Triples     | Medium | 6      | function | xor trick, bit counting          |       |
| 5   | `two-lonely-numbers`   | The Two That Appear Once  | Medium | 7      | function | xor trick, bit masking           |       |
| 6   | `power-of-two-check`   | Is It A Power Of Two      | Easy   | 2      | function | power of two, bit masking        |       |
| 7   | `subsets-by-mask`      | Subsets Without Recursion | Medium | 5      | function | bit masking, subsets             |       |
| 8   | `add-without-plus`     | Add Without Adding        | Medium | 6      | function | bit masking, xor trick           |       |

---

## 8. Batch E — Advanced data structures (`data-structures`)

Mostly `operations` mode: these are problems about a structure's contract rather
than about one answer.

`union-find-sizes` is gone: `graph-union-find` (Graph 13) is the same structure
with the same contract, group sizes included. Batch E is 12 problems (P6-6).

| #   | Slug                    | Title                       | Tier   | Rating | Mode       | Patterns                         | Flags   |
| --- | ----------------------- | --------------------------- | ------ | ------ | ---------- | -------------------------------- | ------- |
| 0   | `prefix-tree`           | A Tree Of Prefixes          | Medium | 6      | operations | design, trie, strings            |         |
| 1   | `prefix-suggestions`    | Suggest As You Type         | Medium | 7      | operations | design, trie, top k              |         |
| 2   | `wildcard-dictionary`   | A Dictionary With Blanks    | Medium | 7      | operations | design, trie, depth-first search |         |
| 3   | `least-recently-used`   | Keep The Recent Ones        | Medium | 7      | operations | design, cache eviction, hash map | trap    |
| 4   | `least-frequently-used` | Keep The Popular Ones       | Hard   | 9      | operations | design, cache eviction, two maps | trap    |
| 5   | `range-sum-mutable`     | Sums That Keep Changing     | Medium | 7      | operations | design, fenwick tree             | trap    |
| 6   | `range-minimum`         | Smallest In Any Range       | Hard   | 8      | operations | design, segment tree             | trap    |
| 7   | `window-maximum`        | Largest In Every Window     | Hard   | 8      | function   | monotonic deque, sliding window  | trap    |
| 8   | `insert-delete-random`  | Add, Remove, Pick At Random | Medium | 6      | operations | design, hash map, randomisation  | checker |
| 9   | `time-keyed-store`      | Values Through Time         | Medium | 6      | operations | design, binary search, hash map  |         |
| 10  | `stream-checker`        | Does The Stream End With    | Hard   | 8      | operations | design, trie, reverse traversal  |         |
| 11  | `rate-limiter`          | Allow, Then Refuse          | Medium | 5      | operations | design, queue                    |         |

---

## 9. Totals

| Batch | Topics                                  | Problems |
| ----- | --------------------------------------- | -------- |
| A     | Arrays, HashMap, Sorting, Binary Search | 45       |
| B     | Linked List, Stack, Matrix              | 36       |
| C     | Binary Tree, Heap, Graph                | 42       |
| D     | Backtracking, DP, Bit Manipulation      | 39       |
| E     | Advanced data structures                | 13       |
| —     | **Total**                               | **175**  |

Twenty of those exist. The remaining 155 are the work of P6-2 … P6-6, and the
number is deliberately under the "about two hundred" of the original plan: a
problem that teaches nothing the one before it did not is worse than no problem,
and the tables above were cut twice on that rule.

## 10. Rules this document is held to

- Every slug here is unique across the catalogue, and every `order` is unique
  within its topic. The validator enforces both.
- Every **trap** problem needs a maximum-size hidden test that the obvious
  approach cannot finish (D21), and an editorial that says so.
- Every **node** problem depends on the harness typing P2-12 settled. Do not
  write one without a judge integration test covering the shape it uses.
- Every **checker** problem ships `checker.ts` and says in the statement that
  any order is accepted.
- Ratings are a first estimate; P6-7 calibrates them against solving time.
