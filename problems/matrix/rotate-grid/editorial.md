# Turn The Grid

## Approach

A cell at `(row, column)` ends up at `(column, n - 1 - row)`. Applying that
directly needs four cells rotated together in a cycle, which works and is fiddly
to index.

The easier route is to notice that the same map is two reflections:

1. **Transpose** — reflect in the main diagonal, swapping `grid[r][c]` with
   `grid[c][r]`.
2. **Reverse each row** — reflect left to right.

Compose them: `(r, c)` goes to `(c, r)` and then to `(c, n-1-r)`. That is the
quarter turn.

The one detail that matters in step 1 is the loop bounds: swap only where
`c > r`. Running over the whole grid swaps every pair twice and leaves it exactly
as it was — a bug that shows up as "my rotation does nothing" and is invisible on
a 1×1 grid.

For an anticlockwise turn, the same two steps with the second one changed to
reversing each *column* — or transpose after reversing the rows. Deriving it that
way is easier than re-deriving the index arithmetic.

## Complexity

- Time: `O(n^2)` — each cell is touched a constant number of times.
- Space: `O(1)`.

## Pitfalls

- **Transposing over the whole grid.** Every swap happens twice and cancels.
- **Building a new grid and assigning it to the parameter.** The caller sees
  nothing; the cells themselves have to be written.
- **Reversing the rows first and then transposing.** That is the anticlockwise
  turn.
- **Assuming a rectangular grid.** Transposing in place needs a square one,
  which the constraints guarantee.
