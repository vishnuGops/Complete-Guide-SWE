# How Long Until All Spoil

## Approach

This is a breadth-first search with **many starting points**. The spread is
simultaneous, so seeding the queue with every initially spoiled cell — before the
clock starts — makes each round of the queue exactly one minute of spreading.

```
queue = every cell holding 2
fresh = the number of cells holding 1
minutes = 0

while queue is not empty and fresh > 0:
    for each of the cells currently in the queue:      # one whole level
        spoil its fresh neighbours, push them, fresh -= 1
    minutes += 1

return fresh == 0 ? minutes : -1
```

Three things are worth stating.

**Level by level.** Take the queue's size *before* expanding, and expand exactly
that many cells. Mixing the new arrivals into the same round counts minutes
wrong. (The alternative is to store a minute alongside each cell, as in
`shortest-grid-path`; both are fine, and this one is the more natural fit when
the answer is the number of rounds rather than a per-cell distance.)

**Count the fresh cells rather than re-scanning.** Decrementing as each one
spoils turns "is anything still fresh?" into a comparison, and it is also how the
`-1` case is detected: whatever is left when the queue empties is unreachable.

**The `and fresh > 0` in the loop condition** is what keeps the answer honest.
Without it, the last round still runs — spoiling nothing, since there is nothing
left — and adds a minute that did not happen.

## Complexity

- Time: `O(rows · columns)`.
- Space: `O(rows · columns)`.

## Pitfalls

- **Starting from one spoiled cell.** The spread is simultaneous; a single source
  gives a larger answer whenever there is more than one.
- **Counting one minute too many.** The final round, in which nothing spoils, is
  the usual culprit.
- **Treating empty cells as passable.** They are gaps, not floors; nothing
  spreads through them.
- **Returning 0 for a crate that has fresh cells and no spoiled ones.** The
  answer there is `-1`.
