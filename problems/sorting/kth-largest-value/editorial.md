# The K-th Largest Reading

## Approach

Sorting the row and taking `readings[n - k]` is correct, costs `O(n log n)`, and
is the right first answer. Everything below is about doing less work than that.

The observation is that you never need the ordering of the readings below the
top `k`, and you never need the ordering _within_ the top `k` either — only its
smallest member. A min-heap of size `k` holds exactly that:

- While the heap holds fewer than `k` readings, push.
- After that, a new reading is either larger than the heap's root, in which case
  it belongs in the top `k` and the root is evicted, or it is not, in which case
  it can be dropped and never looked at again.

The invariant is the whole proof: _the heap always holds the `k` largest
readings seen so far_. When the row runs out, the root is the `k`-th largest.

Cost: `O(n log k)`, and `O(k)` space — which matters when `k` is small and the
row is enormous, or when the readings arrive one at a time and cannot all be
held.

Quickselect is the third answer, averaging `O(n)` by partitioning around a pivot
and recursing into only the side that contains the answer. It is faster on
average and `O(n^2)` in the worst case, and it needs the whole row in memory.

## Complexity

- Time: `O(n log k)`.
- Space: `O(k)`.

## Pitfalls

- **Taking the maximum `k` times.** `O(n·k)`, and at the stated maximum with `k`
  around `n / 2` it does not finish.
- **De-duplicating first.** "The 2nd largest of `[5, 5, 3]`" is 5. Distinct
  values is a different question, and a common misreading.
- **Using a max-heap of everything.** It works and costs `O(n + k log n)`, but it
  gives up the `O(k)` space that motivates the approach.
- **Off by one.** `k = 1` is the maximum, and the sorted-row index is `n - k`,
  not `n - k - 1`.
