# Is It A Search Tree

## Approach

The definition is about whole subtrees, not about parent and child — and the
check has to be too. Comparing each node only with its two children accepts
Example 2, which is exactly why that example is there.

**Carry a range.** Every node's position determines an open interval it must lie
in. The root may hold anything. Stepping left keeps the lower bound and tightens
the upper one to the parent's value; stepping right keeps the upper bound and
raises the lower one.

```
valid(node, low, high):
    if node is null:                    return true
    if not (low < node.val < high):     return false
    return valid(node.left,  low,        node.val)
       and valid(node.right, node.val,   high)
```

That is one pass, and the range is what turns a local rule into a global one:
the 4 in Example 2 arrives with `low = 5` and fails immediately.

**The in-order alternative.** Walking a search tree in order — left, node, right
— produces its values in ascending order, and only a search tree does. So walk
in order and check that each value exceeds the previous one. Just as good, one
pass, and it needs only the previous value rather than a pair of bounds. It is
also what `kth-smallest-in-bst` is built on.

The iterative form of either avoids the recursion depth of a 2000-node chain,
which is what the reference does.

## Complexity

- Time: `O(n)`.
- Space: `O(depth)`.

## Pitfalls

- **Comparing only with the children.** The mistake the problem is built around.
- **Collecting the in-order values and sorting to compare.** It works and is
  `O(n log n)` for something a single comparison per node answers.
- **Bounds that use a fixed sentinel.** Values reach `±10^9`, so a bound of
  `±2^31 - 1` is fine but `±10^9` itself is not; using an absent bound (null,
  `None`, infinity) avoids the question.
- **Allowing equality.** The rule is strict, though the distinct-values
  constraint here means it cannot be observed.
