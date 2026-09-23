# Their Nearest Shared Ancestor

## Approach

**The parent-map answer**, which is the one to reach for first. One walk records
every node's parent. Then climb from the first node to the root, putting each
ancestor into a set; then climb from the second node and stop at the first
ancestor already in the set. Because you climb from the deepest end, the first
match _is_ the lowest one.

`O(n)` time and `O(n)` space, entirely iterative, and it generalises: the same
parent map answers "how far apart are these two nodes" and "what is the path
between them".

**The recursive answer** is shorter and worth understanding. Define a walk that
returns, for a subtree, the ancestor if it is inside — and otherwise whichever of
the two targets it found:

```
find(node):
    if node is null:               return null
    if node is one of the targets: return node
    left  = find(node.left)
    right = find(node.right)
    if left and right:             return node     # one target on each side
    return left or right                           # pass upwards what was found
```

The line that carries the whole argument is `if left and right: return node`.
Below the answer, at most one side ever reports a find; at the answer, both do.
And returning the node itself when it is a target is what makes an ancestor of
the other one the answer — Example 2.

Its depth is the tree's, so on a 2000-node chain it needs its recursion limit
raised, which is why the reference uses the parent map.

## Complexity

- Time: `O(n)`.
- Space: `O(n)` for the parent map.

## Pitfalls

- **Climbing from the root down.** The _first_ shared ancestor found from the top
  is the highest, not the lowest; climb upwards from the nodes instead.
- **Forgetting that a node is its own ancestor.** Example 2 exists for this.
- **The two values being equal.** The answer is that node.
- **Assuming a search tree.** This tree has no ordering, so the value cannot be
  used to choose a direction.
