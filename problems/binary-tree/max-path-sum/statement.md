A path is any sequence of nodes where each is joined to the next by an edge, and
no node appears twice. It need not start at the root or end at a leaf, and it may
turn around at exactly one node — going up from one side and back down the other.

Report the largest total a path can have. A path must contain at least one node,
so the answer is never empty even when every value is negative.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — a non-empty tree

## Output

The largest sum over all paths.

## Constraints

- `1 <= number of nodes <= 10^4`
- `-1000 <= node value <= 1000`

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [1, 2, 3]`

Output: `6`

The path 2 → 1 → 3 turns around at the root.

### Example 2

Input: `root = [-10, 9, 20, null, null, 15, 7]`

Output: `42`

15 → 20 → 7. Going up to the -10 would only lose.

### Example 3

Input: `root = [-3]`

Output: `-3`

A path cannot be empty, so the answer is the least bad single node.

## Notes

Computing, for every node, the best downward path starting at it — by walking its
whole subtree — is `O(n^2)`. At the stated maximum that is a hundred million node
visits and it will not finish.
