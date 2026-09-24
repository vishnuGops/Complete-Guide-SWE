Read a tree one level at a time, top to bottom, and within each level left to
right. Return one list per level.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — the tree, possibly empty

## Output

A list of lists: the first holds the root's value, the second the values on the
next level, and so on. An empty tree produces an empty list.

## Constraints

- `0 <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [6, 2, 13, 5, null, 8, 1]`

Output: `[[6], [2, 13], [5, 8, 1]]`

2 has only a left child, so the third level reads 5 from under 2, then 8 and 1
from under 13.

### Example 2

Input: `root = [-5]`

Output: `[[-5]]`

### Example 3

Input: `root = []`

Output: `[]`

An empty tree has no levels — not one empty level.
