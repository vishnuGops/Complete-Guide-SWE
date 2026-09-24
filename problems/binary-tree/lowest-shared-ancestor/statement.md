An **ancestor** of a node is the node itself, its parent, its parent's parent,
and so on up to the root.

Given two values that both appear in the tree, report the value of their lowest
shared ancestor — the deepest node that is an ancestor of both.

A node can be its own ancestor: if one of the two values is an ancestor of the
other, it is the answer.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `root` — a non-empty tree
- `first` — a value that appears in the tree
- `second` — a value that appears in the tree

## Output

The value of the lowest node that is an ancestor of both.

## Constraints

- `1 <= number of nodes <= 2000`
- `-10^9 <= node value <= 10^9`
- All values are distinct.
- `first` and `second` both appear in the tree; they may be equal to each other.

## Notes

A tree here can be a chain — every node with one child — so its depth can reach
the number of nodes. A recursive solution in Python needs `sys.setrecursionlimit`
raised above that; an iterative one needs nothing.

## Examples

### Example 1

Input: `root = [7, 3, 11, 9, 1, 4, 6]`, `first = 9`, `second = 11`

Output: `7`

9 hangs below 3 on the root's left and 11 is on its right, so the two meet only
at the root.

### Example 2

Input: `root = [7, 3, 11, 9, 1, 4, 6]`, `first = 3`, `second = 1`

Output: `3`

1 is beneath 3, and a node counts as its own ancestor.

### Example 3

Input: `root = [1]`, `first = 1`, `second = 1`

Output: `1`
