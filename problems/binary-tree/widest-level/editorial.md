# The Widest Level

## Approach

The level-by-level queue walk gives the width for free: the queue's size at the
start of a round is exactly the number of nodes on the current level, because
everything added since the previous round came from the level above.

```
best = 0, bestLevel = 0, level = 0
queue = [root] if root else []
while queue is not empty:
    width = queue.size
    level += 1
    if width > best: best, bestLevel = width, level
    repeat width times: pop and push the children that exist
return [best, bestLevel]
```

The comparison is **strictly** greater, which is what sends a tie to the level
closer to the root: a later level of equal width never replaces an earlier one.
Using `>=` would report the lowest such level instead, which is the other
problem.

The empty tree never enters the loop, so `[0, 0]` has to be the starting value
rather than something computed — the one case that is not handled by the walk.

A depth-first walk computes the same thing by counting nodes per depth into a
map or a list indexed by depth, and then taking the largest with the smallest
index. It is the same information gathered in a different order.

## Complexity

- Time: `O(n)`.
- Space: `O(width)` for the queue.

## Pitfalls

- **Reading the queue's size inside the round**, which merges two levels.
- **`>=` instead of `>`**, which breaks ties the other way.
- **Numbering levels from 0.** The root is level 1 here.
- **Counting the nulls.** Only nodes that exist are on a level.
