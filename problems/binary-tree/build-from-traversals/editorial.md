# Rebuild From Two Readings

## Approach

Each reading gives you half of what you need, and together they give you all of
it.

**Pre-order gives the root.** Its first value is the root of whatever subtree you
are looking at.

**In-order gives the split.** Find that root in the in-order reading: everything
to its left belongs to the left subtree, everything to its right to the right
subtree. That is not just the membership — it is the **size** of each side.

And with the sizes known, the pre-order reading splits as well: after the root
come exactly `leftSize` values for the left subtree, then the rest for the right.
So both readings are cut into matching pieces and the same argument applies to
each piece.

```
build(preStart, inStart, count):
    if count == 0: return null
    value = preorder[preStart]
    node  = new node(value)
    mid   = position of value in inorder
    leftSize = mid - inStart
    node.left  = build(preStart + 1,            inStart, leftSize)
    node.right = build(preStart + 1 + leftSize, mid + 1, count - 1 - leftSize)
    return node
```

**The trap is `position of value in inorder`.** Scanning for it is `O(n)` per
node and `O(n^2)` overall — fifty million comparisons on a deep tree at the
stated maximum, which Python does not finish inside the time limit and Java's
JIT does, so in Java it is the target that rules it out. Building a map from value to in-order position once, up
front, makes each lookup `O(1)` and the whole build `O(n)`. That the values are
distinct is what makes the map well-defined, and is why the statement says so.

The reference replaces the recursion with an explicit stack of
`(preStart, inStart, count, parent, side)`, because the tree can be a chain
10,000 nodes deep.

## Complexity

- Time: `O(n)`.
- Space: `O(n)` for the map.

## Pitfalls

- **Scanning for the root each time.** Correct, and quadratic.
- **Getting the right subtree's pre-order start wrong.** It is
  `preStart + 1 + leftSize`, and an off-by-one here builds a tree that is subtly
  wrong rather than obviously broken.
- **Rebuilding the map per call.** That is the scan again, wearing a hash.
- **Assuming in-order plus post-order works the same way.** It does — with the
  root at the _end_ of the post-order piece — but pre-order plus post-order does
  not determine the tree at all.
