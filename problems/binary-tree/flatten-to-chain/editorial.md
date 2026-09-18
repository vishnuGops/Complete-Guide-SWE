# Flatten Into A Chain

## Approach

Consider a node with a left subtree. Pre-order visits the node, then the whole
left subtree, then the right subtree — so in the finished chain, the node's
**right subtree comes immediately after the last node of its left subtree**. And
the last node of a flattened left subtree is its rightmost node.

That gives a rewrite that needs no stack at all:

```
node = root
while node is not null:
    if node.left is not null:
        rightmost = node.left
        while rightmost.right is not null:
            rightmost = rightmost.right
        rightmost.right = node.right      # the right subtree goes after the left
        node.right = node.left            # the left subtree moves across
        node.left  = null
    node = node.right                     # carry on down the growing chain
```

**Why it is linear.** The inner walk to the rightmost node looks like it could
make this quadratic, but each edge of the tree is traversed at most twice across
the whole run — once while descending the chain, once while finding a rightmost
node — so the total is `O(n)`. This is the same accounting as Morris traversal,
and the same shape.

The straightforward alternatives are worth knowing too: collect the pre-order
into a list and relink, or walk with an explicit stack rewiring as you go. Both
are `O(n)` time and `O(n)` space; the rewrite above is the one that gets to
`O(1)`.

## Complexity

- Time: `O(n)`.
- Space: `O(1)`.

## Pitfalls

- **Overwriting `node.right` before attaching it.** It has to be hung off the
  rightmost node of the left subtree first.
- **Not clearing `node.left`.** The result must lean entirely to the right.
- **Recursing on the left subtree first and losing the right one.** A recursive
  version has to save the right child before touching anything.
- **Rebuilding the tree.** The caller sees the nodes, not a fresh tree assigned
  to the parameter.
