Report the depth of a binary tree: the number of nodes on the longest path from
the root down to a leaf.

An empty tree has depth 0; a single node has depth 1.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing. `[2, 5, 4, null, 8]` is a root of 2 whose children
are 5 and 4, where 5 has only a right child, 8, and 4 has no children.

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

Input: `root = [1, 7, 4, 2, null, null, 9, null, 5]`

Output: `4`

The longest path is 1 → 7 → 2 → 5, which is four nodes; the right side stops
at 9 after three.

### Example 2

Input: `root = []`

Output: `0`

### Example 3

Input: `root = [1, 2]`

Output: `2`

One child is enough to make the tree two deep.
