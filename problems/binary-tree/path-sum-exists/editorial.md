# Is There A Path That Sums

## Approach

Carry the running total down the tree instead of collecting paths and adding
them up afterwards. At a node, the question "does some path below here sum to
`needed`?" becomes the same question at each child with `needed - node.val`.

```
has(node, needed):
    if node is null:            return false
    if node is a leaf:          return needed == node.val
    return has(node.left,  needed - node.val)
        or has(node.right, needed - node.val)
```

The definition of "leaf" is what this problem is really testing: **both**
children absent. A node with one child is not a leaf, and the empty side must
not be allowed to answer — that is why the null case returns `false` rather than
"is the remainder zero". Otherwise `[1, 2]` with `target = 1` answers `true`
through the missing right child, which is not a path.

Negative values are allowed, which rules out the natural-looking pruning "stop
when the remainder goes below zero": a later negative value can bring it back.

Iteratively, the same walk is a stack of `(node, remaining)` pairs — which is
what the reference does, because the tree can be a chain 2000 nodes deep.

## Complexity

- Time: `O(n)` — every node is visited at most once, and the search stops early
  when a path is found.
- Space: `O(depth)`.

## Pitfalls

- **Treating a node with one child as a leaf.** Its empty side is not the end of
  a path: in `[1, 2]` with target 1 the root is not a leaf, so the answer is
  `false`. Example 2 is the same mistake on a root with two children.
- **Returning `needed == 0` at a null.** Same bug, written differently.
- **Pruning on a negative remainder.** Values can be negative here.
- **The empty tree.** No paths, so `false` whatever the target — including 0.
