A binary tree is a **search tree** when, for every node, every value in its left
subtree is smaller than it and every value in its right subtree is larger.

Note the words *every value in the subtree* — not just the two children.

Report whether the given tree is a search tree. All values are distinct, so
there is no question about equality.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — the tree, possibly empty

## Output

`true` if the tree is a search tree, `false` otherwise.

## Constraints

- `0 <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`
- All values are distinct.

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [2, 1, 3]`

Output: `true`

### Example 2

Input: `root = [5, 1, 6, null, null, 4, 7]`

Output: `false`

Every node is larger than its left child and smaller than its right one — and
the 4 is in the root's right subtree while being smaller than the root.

### Example 3

Input: `root = []`

Output: `true`

An empty tree is a search tree.

## Notes

Example 2 is the whole problem. A check that only compares a node with its two
children accepts it, and it is not a search tree.
