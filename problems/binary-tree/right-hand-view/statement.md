Stand to the right of the tree and look at it side-on. You see one node per
level: the rightmost one.

Report those values, top to bottom.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — the tree, possibly empty

## Output

The rightmost value on each level, from the root's level downwards.

## Constraints

- `0 <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [1, 2, 3, null, 5, null, 4]`

Output: `[1, 3, 4]`

### Example 2

Input: `root = [1, 2]`

Output: `[1, 2]`

The second level holds only a left child, so that is what you see.

### Example 3

Input: `root = []`

Output: `[]`

## Notes

"Rightmost on the level" is not the same as "keep going right from the root".
Example 2 is the difference: the path to the right ends at the root, and the
answer does not.
