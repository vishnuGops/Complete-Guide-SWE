# Ways Across The Grid

## Approach

A route arrives at a cell from exactly one of two places — above or left — and
those are different routes, so

```
routes[r][c] = routes[r-1][c] + routes[r][c-1]
routes[r][c] = 0                              if the cell is blocked
routes[0][0] = 1                              if it is open
```

Filling the grid top to bottom and left to right means both contributors are
already known when a cell is reached; no recursion is needed and no cell is
computed twice.

**The edges need no special case** if a missing neighbour contributes 0 — which
is the natural reading of "there are no routes from outside the grid". Writing it
with an explicit check for `r == 0` and `c == 0` also works and is where the
off-by-ones live.

**The blocked-cell rule falls out** of setting the cell to 0 rather than skipping
it: a blocked cell contributes nothing to the cells below and to its right, which
is exactly the behaviour a wall should have. A block in the first row cuts off
everything after it in that row, for the same reason, with no extra code.

**Space.** Each row depends only on the row above and on cells already written in
the current row — so one array of `columns` numbers, updated in place left to
right, is enough.

Without blocks the answer is the binomial coefficient `C(rows + columns - 2,
rows - 1)`, which is a one-line closed form. The table exists to handle the
blocks, and is what `cheapest-grid-path` reuses with a minimum in place of the
sum.

## Complexity

- Time: `O(rows · columns)`.
- Space: `O(columns)`.

## Pitfalls

- **Forgetting the blocked start or finish.** Both give zero.
- **Treating a missing neighbour as 1 rather than 0.** The first row and column
  come out wrong.
- **Overflow.** A fifteen by fifteen open grid has 40,116,600 routes, which fits
  in a 32-bit integer — and that is why the grid is capped at fifteen.
- **Recursion without memoisation.** Exponential in the size of the grid.
