# Best Path Through

## Approach

Every path has a **highest node** — the one where it turns around, or its only
node if it does not. Grouping paths by that node turns "every path" into "every
node, once".

For a node, two different quantities matter and they are not the same:

- **The answer it contributes**: `node.val + best downward on the left + best
  downward on the right`. This path turns around here, so it may use both sides.
- **What it reports to its parent**: `node.val + max(left, right)`. A path
  continuing upwards through the parent can pass through only one of the
  node's sides, or the path would visit the node twice.

Confusing those two is the classic wrong answer, and it is why the problem is
rated where it is.

Both use each side clamped at zero:

```
side = max(0, whatever the child reported)
```

because a negative subtree is never worth including — dropping it is always at
least as good. The clamp is also what keeps the answer correct when everything is
negative: the sides contribute 0, and the best candidate is the least negative
single node.

One post-order walk computes both: children report first, the node combines,
`O(n)` in total.

The naive alternative — for each node, walk its whole subtree to find the best
downward path — recomputes the same values `depth` times over and is `O(n^2)`,
which does not finish at the stated maximum.

## Complexity

- Time: `O(n)`.
- Space: `O(n)` for the explicit post-order walk.

## Pitfalls

- **Reporting the two-sided value upwards.** The parent would then build a path
  that visits a node twice.
- **Not clamping at zero.** A negative subtree drags down every path above it.
- **Starting the answer at zero.** An all-negative tree would answer 0, which is
  the empty path.
- **Recursing on a 10,000-node chain.** Depth is the tree's depth, and it can be
  everything.
