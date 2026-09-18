Report the depth of a binary tree: the number of nodes on the longest path from
the root down to a leaf.

An empty tree has depth 0; a single node has depth 1.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing. `[3, 9, 20, null, null, 15, 7]` is a root of 3 whose
children are 9 and 20, where 9 has no children and 20's are 15 and 7.

## Input

- `root` — the tree, possibly empty

## Output

The depth of the tree.

## Constraints

- `0 <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [3, 9, 20, null, null, 15, 7]`

Output: `3`

The longest path is 3 → 20 → 15, which is three nodes.

### Example 2

Input: `root = []`

Output: `0`

### Example 3

Input: `root = [1, 2]`

Output: `2`

One child is enough to make the tree two deep.
