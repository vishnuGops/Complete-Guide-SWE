A root-to-leaf path starts at the root and ends at a leaf — a node with no
children at all.

Report every root-to-leaf path whose values add up to `target`, each as the list
of values along it.

Return the paths in the order a left-first walk finds them: at each node, the
paths through its left subtree come before the paths through its right one.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — the tree, possibly empty
- `target` — the sum to look for

## Output

A list of paths, each a list of values from the root to a leaf, in left-first
order. An empty list if there are none.

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

Input: `root = [5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1]`, `target = 22`

Output: `[[5, 4, 11, 2], [5, 8, 4, 5]]`

Two paths reach 22; the one through the left subtree comes first.

### Example 2

Input: `root = [1, 2, 3]`, `target = 5`

Output: `[]`

The paths sum to 3 and 4.

### Example 3

Input: `root = [1, 2]`, `target = 1`

Output: `[]`

The root alone is not a path, because the root is not a leaf.
