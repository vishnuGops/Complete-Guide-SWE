A root-to-leaf path is a path that starts at the root and ends at a leaf — a node
with no children at all.

Report whether some root-to-leaf path's values add up to `target`.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — the tree, possibly empty
- `target` — the sum to look for

## Output

`true` if some root-to-leaf path sums to `target`, `false` otherwise.

## Constraints

- `0 <= number of nodes <= 2000`
- `-1000 <= node value <= 1000`
- `-10^6 <= target <= 10^6`

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [4, 9, 1, 2, null, 6, 8]`, `target = 11`

Output: `true`

4 + 1 + 6 = 11, and 6 is a leaf.

### Example 2

Input: `root = [1, 2, 3]`, `target = 1`

Output: `false`

The root alone is not a path: 1 is not a leaf. The paths are 1 + 2 and 1 + 3.

### Example 3

Input: `root = []`, `target = 0`

Output: `false`

An empty tree has no paths at all, not even one summing to zero.
