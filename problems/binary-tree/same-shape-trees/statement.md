Two trees are the same when they have the same shape and the same value at every
matching position.

Report whether the two given trees are the same.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `first` — a tree, possibly empty
- `second` — a tree, possibly empty

## Output

`true` if the two trees are the same, `false` otherwise.

## Constraints

- `0 <= number of nodes in each tree <= 2000`
- `-10^9 <= node value <= 10^9`

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `first = [1, 2, 3]`, `second = [1, 2, 3]`

Output: `true`

### Example 2

Input: `first = [1, 2]`, `second = [1, null, 2]`

Output: `false`

The same values, on opposite sides. Shape is part of being the same.

### Example 3

Input: `first = []`, `second = []`

Output: `true`

Two empty trees are the same.
