# Median Of The Last K

## Approach

The median is a question about the middle of a sorted window, and the window
only changes by one reading at each step. So the goal is a structure that can
answer "what is in the middle" in `O(1)` and absorb one insertion and one
removal in `O(log k)`.

Two heaps do it. Keep the smaller half of the window in a max-heap (`small`) and
the larger half in a min-heap (`large`), with the sizes kept so that
`0 <= |small| - |large| <= 1`. Then the median is the top of `small` when `k` is
odd, and the average of the two tops when `k` is even.

Insertion is easy: compare against the top of `small`, push onto the right heap,
then move one element across if the sizes drifted.

Removal is the hard half, because a binary heap cannot delete from the middle.
The trick is **lazy deletion**: when a reading leaves the window, record it in a
map of readings that are owed a deletion, and decrement the size counter of
whichever half it belonged to. The element stays physically in its heap until it
reaches the top, at which point it is discarded instead of used. The size
counters — not the heaps' own sizes — are what the rebalancing reads, so the
structure behaves as if the deletion happened immediately.

The two invariants worth stating, because everything else follows from them:

1. Neither heap's top is a reading that has already left the window.
2. `smallSize` and `largeSize` count only readings still in the window, and
   `smallSize` is either equal to `largeSize` or one larger.

## Complexity

- Time: `O(n log k)`.
- Space: `O(k)` for the live readings, plus the owed ones still waiting to
  surface — also `O(k)`, since a reading is owed for at most as long as it sits
  below a live one.

## Pitfalls

- **Sorting each window.** `O(n k log k)`. At the stated maximum with `k`
  around `n / 2` it runs close to Python's time limit and inside Java's, so it
  is the target, not the clock, that rules it out. Inserting into a sorted list with a binary
  search is better but still moves `O(k)` elements per step.
- **Trusting `heap.size()`.** Once lazy deletion is in play the physical size
  includes readings that have left. Rebalance on the counters.
- **Pruning only one heap.** After moving an element across during a rebalance,
  the heap you took it from may now be exposing an owed reading.
- **Integer overflow on the even case.** Two readings near `10^9` sum to `2·10^9`,
  which does not fit in a 32-bit `int`. Add them as `long` or as `double`.
