## Approach

Unsorted, any window can overlap any other, which is `O(n^2)` comparisons. Sorting
by start removes that: once the windows are in start order, a window can only
ever overlap the one currently being built, because everything later starts at or
after it.

So: sort, then sweep. Hold a current window. For each next window, if it starts at
or before the current end, it belongs to the same outage and the current end
stretches to cover it. Otherwise the current window is complete - emit it and
start a new one from the next window.

Touching counts as overlapping, which is the difference between `next.start <=
current.end` and `next.start < current.end`. The statement decides that, not the
algorithm.

## Complexity

- Time: `O(n log n)`, dominated by the sort.
- Space: `O(n)` for the result.

## Pitfalls

- Setting the current end to `next.end` instead of the larger of the two loses a
  window entirely contained in the one before it, like `[1, 9]` then `[2, 3]`.
- Forgetting to emit the window still in hand when the loop ends.
- Sorting by end, or not sorting at all, makes the neighbour argument false and
  the sweep wrong.
