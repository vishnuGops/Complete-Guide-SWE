# Nodes Nothing Blocks

## Approach

The property is about the path from the root, and the only thing about that path
that matters is its **largest value**. So carry that value down.

```
walk(node, best):
    if node is null: return 0
    count = 1 if node.val >= best else 0
    best  = max(best, node.val)
    return count + walk(node.left, best) + walk(node.right, best)
```

started at the root with `best = root.val` — or with minus infinity, which makes
the root unblocked by construction.

This is the running maximum of `running-maximum`, applied along every root-to-
leaf path at once, and it works because the maximum along a path only ever
increases as you descend: what a parent hands down is already correct for every
node beneath it.

The comparison is `>=`: equal does not block, which Example 2 is there to pin
down.

The iterative form carries the pair `(node, best)` on a stack, which is what the
reference uses — a tree here can be a chain 2000 nodes deep.

## Complexity

- Time: `O(n)`.
- Space: `O(depth)`.

## Pitfalls

- **Re-walking the path at each node to find its maximum.** That is `O(n · depth)`
  and is `O(n^2)` on a chain.
- **Using `>` instead of `>=`.** Equal values stop being counted.
- **Starting `best` at 0.** Every value may be negative, and then nothing is
  counted; start at the root's own value or at minus infinity.
- **Updating `best` before the comparison.** A node would then block itself and
  never be counted.
