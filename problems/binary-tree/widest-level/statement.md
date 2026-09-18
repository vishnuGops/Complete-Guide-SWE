Report the number of nodes on the most crowded level of the tree, and which level
that is.

Levels are numbered from 1 at the root. If several levels tie for the most nodes,
report the highest of them — the one closest to the root.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — the tree, possibly empty

## Output

A list of two integers: the number of nodes on the most crowded level, and that
level's number. For an empty tree, `[0, 0]`.

## Constraints

- `0 <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [1, 2, 3, 4, 5, null, 6]`

Output: `[3, 3]`

The third level holds 4, 5 and 6.

### Example 2

Input: `root = [1, 2]`

Output: `[1, 1]`

Both levels hold one node, and the tie goes to the higher one.

### Example 3

Input: `root = []`

Output: `[0, 0]`
