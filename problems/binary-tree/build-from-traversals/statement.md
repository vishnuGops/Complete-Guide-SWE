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
overall. At the stated maximum that is a hundred million comparisons and it will
not finish.

## Examples

### Example 1

Input: `preorder = [3, 9, 20, 15, 7]`, `inorder = [9, 3, 15, 20, 7]`

Output: `[3, 9, 20, null, null, 15, 7]`

### Example 2

Input: `preorder = [1]`, `inorder = [1]`

Output: `[1]`

### Example 3

Input: `preorder = [1, 2]`, `inorder = [2, 1]`

Output: `[1, 2]`

2 comes before 1 in the in-order reading, so it is on the left.
