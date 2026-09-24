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

Input: `root = [7, 4, 4, 9, -2, -2, 9]`

Output: `true`

The two 4s match, and below them `9, -2` mirrors `-2, 9`.

### Example 2

Input: `root = [6, 5, 5, 8, null, 8]`

Output: `false`

Both 5s have a left child and no right child; a reflection would need one of
each.

### Example 3

Input: `root = []`

Output: `true`

An empty tree reflects to itself.
