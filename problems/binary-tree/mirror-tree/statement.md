A tree is its own reflection when holding a mirror down the middle would change
nothing: the left subtree is the mirror image of the right one, all the way
down.

Report whether the given tree is its own reflection.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — the tree, possibly empty

## Output

`true` if the tree is its own reflection, `false` otherwise.

## Constraints

- `0 <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [1, 2, 2, 3, 4, 4, 3]`

Output: `true`

### Example 2

Input: `root = [1, 2, 2, null, 3, null, 3]`

Output: `false`

Both 2s have a right child and no left child; a reflection would need one of
each.

### Example 3

Input: `root = []`

Output: `true`

An empty tree reflects to itself.
