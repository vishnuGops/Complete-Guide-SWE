# Fewest Steps Across

## Approach

Every step costs one, so the cells can be explored in order of distance:
everything zero steps away, then everything one step away, and so on. A queue
produces exactly that order, and the **first** time the finish is reached it is
by a shortest route — there is no need to keep looking.

```
if the start or the finish is blocked: return -1
queue = [(start, distance 1)]
mark the start visited
while the queue is not empty:
    (cell, distance) = queue.pop_front()
    if cell is the finish: return distance
    for each open, unvisited neighbour:
        mark it visited
        queue.push_back((neighbour, distance + 1))
return -1
```

Two details carry it.

**Mark on push, not on pop.** A cell has up to four neighbours, and each of them
would otherwise push it. Marking at push time keeps every cell in the queue at
most once, which is what makes the search `O(rows · columns)` rather than
exponential in the worst case.

**The distance is per cell, not global.** Carrying it alongside each queue entry
is the simplest way; processing the queue one whole level at a time and counting
levels is the other, and is what `rotting-spread` needs.

Why not depth-first? It finds *a* route, not the shortest — the first one it
stumbles into can wander arbitrarily far. Depth-first answers "is there a route";
breadth-first answers "how short is the shortest".

## Complexity

- Time: `O(rows · columns)`.
- Space: `O(rows · columns)` for the queue and the visited marks.

## Pitfalls

- **Using a stack.** That is a depth-first search and it gives the wrong answer,
  usually a much larger number.
- **Marking on pop.** The queue fills with duplicates and the search slows down
  sharply on open grids.
- **Forgetting the blocked start or finish.** A grid whose first cell is `1` has
  no route at all.
- **Counting steps instead of cells.** A single open cell answers 1, so the
  start counts.
