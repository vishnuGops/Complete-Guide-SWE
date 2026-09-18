# How Many Queen Placements

## Approach

**One queen per row**, because two queens in a row always attack. So the search
is not over squares but over *which column* each row's queen takes: `n` levels,
at most `n` branches each, and a permutation at the bottom.

That alone is `n!` rather than `n^n` — 6.2 billion against 300 billion at
`n = 13` — and the pruning cuts it much further.

**The three things to check** before placing a queen at `(row, column)`:

- **Column** — has some earlier row used it?
- **The `↘` diagonal** — every square on it has the same `row - column`.
- **The `↙` diagonal** — every square on it has the same `row + column`.

Keeping a set of used columns and one per diagonal family makes each check
`O(1)`, and checking *before* recursing means an attacked square is never
explored at all. That is the whole difference between a search that finishes at
`n = 13` and one that does not.

**Bit masks make it fast.** Three integers — used columns, used `↘` diagonals,
used `↙` diagonals — with the diagonal masks shifted by one as the search moves
down a row, because a diagonal that blocks column `c` on this row blocks `c ± 1`
on the next:

```
place(columns, down, up):
    if columns == all ones: count += 1; return
    free = allOnes & ~(columns | down | up)
    while free != 0:
        bit = free & -free            # the lowest free column
        free -= bit
        place(columns | bit, ((down | bit) << 1) & allOnes, (up | bit) >> 1)
```

`free & -free` isolates the lowest set bit, so the loop visits exactly the
available columns and nothing else — no scan over occupied ones. This is the
standard formulation, and the shift is what replaces the `row ± column`
bookkeeping.

The counts, for reference: 1, 0, 0, 2, 10, 4, 40, 92, 352, 724, 2680, 14200,
73712.

## Complexity

- Time: `O(n!)` in the worst case, far less in practice.
- Space: `O(n)` for the recursion.

## Pitfalls

- **Searching over squares rather than columns.** `n^n`, and it does not finish.
- **Checking after placing.** The whole subtree below an attacked square is
  explored first.
- **Getting the diagonals the wrong way round.** `row + column` and
  `row - column` identify the two families; using one for both misses half the
  attacks.
- **Forgetting that `n = 2` and `n = 3` have no placements.**
