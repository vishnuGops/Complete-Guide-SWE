# Water Held Between

## Approach

Stop thinking about puddles and think about one column at a time. The water
standing on column `i` reaches the level of the lower of the two walls around
it:

```
water[i] = min(tallest to the left of i, tallest to the right of i) - heights[i]
```

clamped at zero. Summing that over all `i` is the answer.

Both "tallest to the left" and "tallest to the right" are running maxima, so two
passes and two arrays give an `O(n)` time, `O(n)` space answer. That is a
complete solution and worth writing first.

**Getting to `O(1)` space** is the insight the problem exists for. Walk two
pointers inwards from the ends, keeping `leftMax` and `rightMax` for what each
has seen so far. At each step, compare `heights[left]` with `heights[right]`:

- If `heights[left] < heights[right]`, then *whatever* lies between them, the
  right-hand wall for the left column is at least `heights[right]`, which is
  already higher than `heights[left]`. So the binding wall is the left one, and
  `leftMax - heights[left]` is the final answer for that column. Settle it and
  advance `left`.
- Otherwise, do the mirror image on the right.

The claim being used is not "the maxima are known" — they are not — but "the
maximum on the *other* side is already at least as large as this side's, so it
cannot be the limiting one". That is enough.

The monotonic stack is the third answer: keep a decreasing stack of positions,
and when a taller column arrives, the popped position is the floor of a puddle
bounded by the new column and whatever is below it on the stack — water is added
in horizontal layers rather than vertical columns. Same `O(n)`, `O(n)` space, and
it is the shape that generalises to two dimensions.

## Complexity

- Time: `O(n)`.
- Space: `O(1)` for the two-pointer form; `O(n)` for the other two.

## Pitfalls

- **Recomputing the maxima per column.** `O(n^2)`, and it does not finish at the
  stated maximum.
- **Advancing the taller side.** The argument only works when the shorter side
  moves; advancing the other one settles a column whose binding wall is still
  unknown.
- **Updating the maximum after taking the water.** `leftMax` must already include
  `heights[left]`, or a column taller than everything before it contributes
  negative water.
- **The empty row and rows of one or two columns.** All hold nothing, and the
  loop conditions should say so without a special case.
