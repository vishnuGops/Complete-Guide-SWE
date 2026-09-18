# Regions With No Way Out

## Approach

Asking "is this region enclosed?" needs the whole region before it can be
answered. Asking the **complement** — "which cells are definitely not enclosed?"
— has a much easier answer: the open cells on the edge, and everything joined to
them.

So the algorithm inverts the problem:

1. Flood-fill inwards from every open cell on the edge, marking each cell it
   reaches with a third value (say `2`).
2. Sweep the whole plan: an open cell still holding `0` was never reached, so it
   is enclosed and becomes `1`; a cell holding `2` is restored to `0`.

One fill and one sweep, `O(rows · columns)` in total, and no region is ever
examined twice.

The third value is what makes the single sweep possible: during the fill,
"reached" and "not yet reached" have to be distinguishable from each other and
from walls, which is three states. A separate boolean grid does the same job and
costs the same asymptotically.

**Recursion depth**, as in `count-islands`: a plan that is entirely open is ten
thousand cells in one region, which a recursive fill cannot hold on Python's
default stack. The reference uses an explicit stack.

Cells join up, down, left and right only — a diagonal gap does not let a region
out, which is the same rule and the same trap as in `count-islands`.

## Complexity

- Time: `O(rows · columns)`.
- Space: `O(rows · columns)` for the fill's stack in the worst case.

## Pitfalls

- **Filling from the inside out.** Finding a region and then checking whether any
  of its cells is on the edge works, and it is more code and easier to get wrong.
- **Forgetting a whole edge.** All four sides seed the fill, and the corners
  belong to two of them.
- **Not restoring the mark.** The cells marked `2` are open cells and must end as
  `0`.
- **Recursing on an all-open plan.** Ten thousand frames deep.
