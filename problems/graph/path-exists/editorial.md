# Can You Get There

## Approach

Two steps, and the first is the one people skip.

**Build the adjacency list.** The input is an edge list; answering "where can I
go from here" from it means scanning every road. One pass turns it into
neighbours-per-place, and the walk then costs `O(1)` per step.

**Walk from the start**, marking places as you reach them, until you reach the
finish or run out of places to try.

Depth-first or breadth-first — it genuinely does not matter here, because the
question is *whether* the finish is reachable, not how far away it is. Swap the
stack for a queue and the same code answers "how many roads at least", which is
`shortest-grid-path` on a graph instead of a grid.

**Mark on push, not on pop.** A place with many roads would otherwise be pushed
once per road, and on a dense graph that is the difference between linear and
quadratic.

The start-equals-finish case answers `true` and falls out of checking the finish
as soon as it is reached, including at the start — worth checking before the loop
rather than only inside it.

## Complexity

- Time: `O(n + roads)`.
- Space: `O(n + roads)`.

## Pitfalls

- **Scanning the road list at every step.** `O(n · roads)`.
- **Adding roads one way.** They are two-way.
- **Marking on pop.** Slow on dense graphs, and it can revisit.
- **Forgetting `start == finish`.**
