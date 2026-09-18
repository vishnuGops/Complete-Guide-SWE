Flatten a tree into a chain that leans entirely to the right: every node's left
child becomes empty, and its right child is the node that a **pre-order** walk —
node, then left subtree, then right subtree — visits next.

Change the tree you are given. Nothing is returned.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing, so a right-leaning chain of 1, 2, 3 is
`[1, null, 2, null, 3]`. An empty tree is `[]` as an input and `null` as a
result, because a result is a node to point at and there is none.

## Input

- `root` — the tree, possibly empty, changed in place

## Output

Nothing. After the call the tree is a right-leaning chain in pre-order.

## Constraints

- `0 <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`
- Aim for `O(1)` extra space.

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [1, 2, 5, 3, 4, null, 6]`

Output: `root` becomes `[1, null, 2, null, 3, null, 4, null, 5, null, 6]`

Pre-order reads 1, 2, 3, 4, 5, 6.

### Example 2

Input: `root = [1]`

Output: unchanged

### Example 3

Input: `root = []`

Output: unchanged
