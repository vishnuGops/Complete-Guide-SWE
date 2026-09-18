# Blank The Row And Column

## Approach

The difficulty is entirely about **ordering**, not about speed. Blanking a row
the moment you find a zero writes zeroes into the grid, and the rest of the scan
cannot tell them from the originals — Example 1 collapses to an all-zero grid.

So: find first, blank second.

**The straightforward answer.** One pass collecting the set of rows and the set
of columns that hold a zero, then a second pass blanking every cell whose row or
column is in one of them. `O(rows · columns)` time and `O(rows + columns)` space,
and it is a perfectly good solution.

**Constant space.** The two sets are each a list of booleans as long as a row or a
column — and the grid already has a row and a column that could hold them. Use
`grid[0][c]` to record "column `c` must be blanked" and `grid[r][0]` for "row `r`
must be blanked".

The collision is `grid[0][0]`, which would have to mean both "blank row 0" and
"blank column 0". Split it: keep a single boolean for the first column, and let
`grid[0][0]` speak only for the first row. Then:

1. Scan the first column; if any cell is zero, set `firstColumnBlank`.
2. Scan the rest of the grid; for each zero at `(r, c)` with `c > 0`, set
   `grid[r][0] = 0` and `grid[0][c] = 0`.
3. Blank the interior — cells with `r > 0` and `c > 0` — using those marks.
4. If `grid[0][0]` is zero, blank the whole first row.
5. If `firstColumnBlank`, blank the whole first column.

Steps 3 to 5 must happen in that order: the marks live in the first row and
column, so those are blanked last, once nothing else needs to read them.

## Complexity

- Time: `O(rows · columns)`.
- Space: `O(1)`.

## Pitfalls

- **Blanking during the search.** The bug this problem exists for.
- **Blanking the marker row or column too early.** It destroys the information
  the rest of the pass depends on.
- **One flag instead of two.** `grid[0][0]` genuinely carries two meanings; one
  of them needs its own variable.
- **Rebuilding the grid.** The caller sees the cells, not a new list assigned to
  the parameter.
