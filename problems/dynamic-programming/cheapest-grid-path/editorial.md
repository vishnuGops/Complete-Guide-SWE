# Cheapest Way Across

## Approach

This is `grid-paths` with a **minimum in place of the sum**, which is worth
saying plainly: the table's shape, the fill order and the edge handling are
identical, and only the combining operation changes.

```
cheapest[r][c] = tolls[r][c] + min(cheapest[r-1][c], cheapest[r][c-1])
cheapest[0][0] = tolls[0][0]
```

Filling top to bottom and left to right means both contributors are known when a
cell is reached.

**The edges.** A missing neighbour should be _infinitely_ expensive rather than
zero — the opposite of `grid-paths`, where a missing neighbour contributed zero
routes. Getting that backwards makes the first row and column free, and the
answer far too small. Writing the first row and column explicitly as running
sums is the other way, and is often clearer.

**Space.** As before, a cell needs only the value above (still in the array) and
to the left (already updated), so one array of `columns` numbers suffices.

**Why not Dijkstra.** `cheapest-route` would also answer this — the grid is a
graph and the tolls are weights. It costs `O(rows · columns · log)` instead of
`O(rows · columns)`, and the extra factor buys generality this problem does not
need: because the moves only ever go right or down, the cells can be visited in
an order where every predecessor is already final. A priority queue exists to
discover such an order when one is not obvious; here it is obvious.

## Complexity

- Time: `O(rows · columns)`.
- Space: `O(columns)`.

## Pitfalls

- **Treating a missing neighbour as 0.** The first row and column become free.
- **Forgetting the starting cell's own toll.** It is paid.
- **A greedy walk** — always stepping to the cheaper neighbour — which is wrong
  as soon as a cheap cell leads into an expensive region.
- **Recursion without memoisation.** Exponential.
