Given a search tree — every value in a node's left subtree is smaller than it,
every value in its right subtree larger — report its `k`-th smallest value,
counting from 1.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — a non-empty search tree
- `k` — which smallest value to report, counting from 1

## Output

The `k`-th smallest value in the tree.

## Constraints

- `1 <= k <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`
- All values are distinct and the tree is a valid search tree.

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [3, 1, 4, null, 2]`, `k = 1`

Output: `1`

### Example 2

Input: `root = [3, 1, 4, null, 2]`, `k = 3`

Output: `3`

In order the values are 1, 2, 3, 4.

### Example 3

Input: `root = [5]`, `k = 1`

Output: `5`
