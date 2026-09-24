# The Same Tree Twice

## Approach

Walk the two trees **in step**, comparing pairs of positions rather than two
sequences. At any pair:

- both missing → agreed, nothing below to check;
- exactly one missing → the shapes differ, so `false`;
- both present → the values must be equal, and so must both pairs of children.

```
same(a, b) = true                 if a and b are both null
           = false                if exactly one is null
           = a.val == b.val and same(a.left, b.left) and same(a.right, b.right)
```

The shape check needs no separate pass: it _is_ the "exactly one missing" case.

Iteratively, the same walk is a stack of pairs — push `(a.left, b.left)` and
`(a.right, b.right)`, and apply the same three cases as each pair is popped.
That is what the reference does, because a tree here can be a chain 2000 nodes
deep.

**Why not compare traversals?** Because a traversal that omits the nulls loses
the shape: `[1, 2]` and `[1, null, 2]` both have preorder `1, 2`. Writing the
nulls down does fix it, and is the idea `serialise-tree` is built on — but it
allocates two lists to answer a question that needs neither.

## Complexity

- Time: `O(n)` — the walk stops at the first disagreement, and visits every node
  at most once otherwise.
- Space: `O(depth)`.

## Pitfalls

- **Comparing null-free traversals.** Example 2 is there for exactly this, and
  in-order is no safer: `[2, 1]` and `[1, null, 2]` both read `1, 2`.
- **Checking only one side's null-ness.** `a is null and b is null` must be
  distinguished from `a is null or b is null`.
- **Returning early on the first _match_.** The answer is an `and` over the whole
  tree, not an `or`.
