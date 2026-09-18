# Seen From The Right

## Approach

The answer is one value per level — the last in left-to-right order — so the
level-by-level queue walk from `level-order-reading` already computes it. Fix
the level's width before the round, expand exactly those nodes, and keep the
last value.

**The depth-first version is the more interesting one.** Walk the tree visiting
the **right child first**, carrying the depth. Then the first node reached at any
given depth is the rightmost node on that level, so:

```
walk(node, depth):
    if node is null: return
    if depth == len(result): result.append(node.val)   # first at this depth
    walk(node.right, depth + 1)
    walk(node.left,  depth + 1)
```

`depth == len(result)` is the whole condition: the result has one entry per level
already seen, so a node is the first at its depth exactly when its depth equals
the number of entries. Reversing the visiting order — left first — gives the left-
hand view from the same code.

**The misreading to avoid** is "follow the right child from the root". That gives
the right *spine*, not the right view, and the two differ the moment a right
child is missing while a left child is not — Example 2, where the answer has two
entries and the spine has one.

## Complexity

- Time: `O(n)`.
- Space: `O(width)` for the queue, or `O(depth)` for the walk.

## Pitfalls

- **Following the right spine.** The common wrong answer, and it passes on any
  tree where every node with children has a right child.
- **Taking the first value of each level.** That is the left-hand view.
- **Reading the queue's size inside the round** — the same trap as
  `level-order-reading`.
