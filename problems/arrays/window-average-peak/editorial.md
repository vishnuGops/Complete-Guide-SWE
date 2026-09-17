## Approach

Two windows that start one apart overlap in `width - 1` readings. Recomputing
the whole sum for each one throws that overlap away and costs `O(n * width)`.

A running total makes each slide cost two operations: add the reading that just
entered on the right, subtract the one that just left on the left. Sum the first
window directly, then slide to the end.

The tie rule falls out of the comparison. Updating the best only when the new
total is **strictly** larger means the first window to reach a total keeps it.

## Complexity

- Time: `O(n)` - one pass, constant work per step.
- Space: `O(1)`.

## Pitfalls

- Using `>=` instead of `>` returns the last tied window rather than the first.
- The loop over starting positions runs to `n - width` inclusive; an off-by-one
  here either skips the final window or reads past the end.
- A negative total is still a valid answer. Initialising the best to `0` instead
  of to the first window's total breaks every all-negative case.
