Two readings of the same tree are given.

- **Pre-order** visits a node, then its left subtree, then its right one.
- **In-order** visits the left subtree, then the node, then the right one.

Rebuild the tree and return it. All values are distinct, so the two readings
determine the tree exactly.

A tree is written as its levels, top to bottom and left to right, with `null`
where a node is missing.

## Input

- `preorder` — the values in pre-order
- `inorder` — the values in in-order

## Output

The rebuilt tree.

## Constraints

- `1 <= preorder.length <= 10^4`
- `inorder.length == preorder.length`
- `-10^9 <= value <= 10^9`
- All values are distinct, and the two lists are readings of the same tree.

## Notes

Searching `inorder` for the root of each subtree is `O(n)` per node and `O(n^2)`
overall. On a deep tree at the stated maximum that is fifty million comparisons:
too slow for the time limit in Python, though Java's JIT gets through it. Either
way it misses the `O(n)` target.

## Examples

### Example 1

Input: `preorder = [8, 4, 6, 11, 10]`, `inorder = [4, 6, 8, 10, 11]`

Output: `[8, 4, 11, null, 6, 10]`

8 comes first in pre-order, so it is the root. In-order puts `4, 6` to its left
and `10, 11` to its right, and the same split, applied again, hangs 6 to the
right of 4 and 10 to the left of 11.

### Example 2

Input: `preorder = [1]`, `inorder = [1]`

Output: `[1]`

### Example 3

Input: `preorder = [1, 2]`, `inorder = [2, 1]`

Output: `[1, 2]`

2 comes before 1 in the in-order reading, so it is on the left.
