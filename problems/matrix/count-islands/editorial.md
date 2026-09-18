# How Many Islands

## Approach

Each island is a connected component, and counting components is always the same
shape: scan for a cell you have not visited, count one, then visit everything
reachable from it so it is never counted again.

```
for every cell:
    if it is land and not yet visited:
        islands += 1
        flood fill from it
```

The flood fill is a depth-first or breadth-first walk over the four edge
neighbours, refusing to step off the grid or onto water. Every cell is visited at
most once across the whole run, so the total cost is `O(rows · columns)` no
matter how many islands there are.

**Marking visited.** The tidy way is a separate boolean grid. The cheaper way is
to overwrite the land with water as you fill — "sinking the island" — which needs
no extra grid at all. It changes the input, which is fine when the caller does
not need it afterwards and is worth stating when it is not.

**Recursion depth.** A depth-first fill written recursively goes as deep as the
island is large. At the stated maximum that is ten thousand frames, which
overflows Python's default limit of a thousand and is uncomfortably close to a
default JVM stack. An explicit stack — the same algorithm, a list instead of the
call stack — has no such limit, and is what the reference uses.

## Complexity

- Time: `O(rows · columns)` — every cell is pushed and popped at most once.
- Space: `O(rows · columns)` in the worst case, when the stack holds a whole
  island.

## Pitfalls

- **Counting cells instead of components.** Each island contributes one,
  regardless of size.
- **Joining diagonals.** Four neighbours, not eight; Example 1 is there for this.
- **Recursing on a full grid.** Ten thousand frames deep is a crash, not a slow
  answer.
- **Not marking a cell until it is popped.** It can then be pushed many times by
  different neighbours; mark it when it is pushed.
