# How Deep It Goes

## Approach

The definition is already recursive: the depth of a tree is one more than the
deeper of its two subtrees, and the depth of nothing is zero.

```
depth(node) = 0                                   if node is null
            = 1 + max(depth(left), depth(right))  otherwise
```

Every node is visited once, so this is `O(n)`.

**Iteratively**, the same number is the count of levels. Walk the tree with a
queue, taking one whole level at a time — the queue's size before the round is
exactly how many nodes are on the current level — and add one per round. This is
the breadth-first shape from `rotting-spread`, and it has no recursion depth to
worry about.

That matters here more than it looks. A tree of 2000 nodes can be a chain, and
a recursive traversal is then 2000 frames deep, which exceeds Python's default
limit of a thousand. Raising the limit is a one-line fix; the level walk needs
no fix at all.

## Complexity

- Time: `O(n)`.
- Space: `O(depth)` for the recursion or `O(width)` for the queue — both `O(n)`
  in the worst case, for opposite shapes of tree.

## Pitfalls

- **Counting edges.** A single node is depth 1 here.
- **`1 + max(...)` on a node with one child.** The missing side contributes 0,
  which is what makes the answer 2 rather than 1 in Example 3.
- **A chain 2000 deep.** Recursion needs its limit raised.
