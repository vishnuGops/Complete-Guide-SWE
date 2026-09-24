# The Median So Far

## Approach

The median is a question about the middle of a sorted collection, so keep the
collection split at the middle and keep both sides' extremes visible.

- **`small`** — a max-heap holding the smaller half. Its root is the largest of
  them.
- **`large`** — a min-heap holding the larger half. Its root is the smallest.

Maintain `0 <= |small| - |large| <= 1`. Then:

- an odd total means `small` has one more, and the median is its root;
- an even total means the halves are equal, and the median is the average of the
  two roots.

Adding a reading is two steps:

1. Push it onto `small` if it is at most `small`'s root, otherwise onto `large`.
2. Rebalance: if `small` has grown two ahead, move its root to `large`; if
   `large` has overtaken, move its root to `small`.

Each step is `O(log n)`, and the median itself is `O(1)`.

**This is `window-median-stream` without the hard half.** There, readings leave
the window and a binary heap cannot delete from its middle, which forces lazy
deletion and a pair of size counters. Here nothing ever leaves, so the heaps'
own sizes are the truth and the whole structure is twenty lines. Meeting the
easier version first is the point of its place in this topic.

**The averaging overflows.** Two readings near `10^9` sum to `2·10^9`, past a
32-bit `int`. Add them as `long` or as `double` before halving.

## Complexity

- Time: `O(log n)` per reading, `O(1)` per median.
- Space: `O(n)`.

## Pitfalls

- **Rebalancing before inserting.** The comparison that chooses a side needs a
  root to compare against; on the very first reading there is none, which is the
  case to handle.
- **Allowing the halves to drift by two.** Then neither root is the middle.
- **Integer overflow when averaging**, and integer _division_ when averaging —
  `(a + b) / 2` on two integers truncates.
- **Sorting the readings on every call.** Correct, and `O(n log n)` per reading.
  Keeping one sorted list and inserting with a binary search is `O(n)` per
  reading, but the shift is a single memory move, and at `10^4` readings it
  finishes comfortably in both languages. The heaps are the target because they
  are `O(log n)`, not because anything slower times out here.
