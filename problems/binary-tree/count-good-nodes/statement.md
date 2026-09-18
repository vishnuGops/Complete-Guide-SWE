Looking down from the root, a node is *unblocked* when nothing on the path from
the root to it — the root included — holds a larger value.

Count the unblocked nodes. The root is always one of them.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — the tree, possibly empty

## Output

The number of unblocked nodes.

## Constraints

- `0 <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [3, 1, 4, 3, null, 1, 5]`

Output: `4`

The root, the 4, the 3 under the 1, and the 5. The 1s are both blocked by the 3
above them.

### Example 2

Input: `root = [3, 3, null, 4, 2]`

Output: `3`

The root, the second 3 — equal is not larger, so it is not blocked — and the 4.

### Example 3

Input: `root = []`

Output: `0`

No nodes, none unblocked.
