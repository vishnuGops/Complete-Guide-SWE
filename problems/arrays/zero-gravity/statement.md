A row of slots holds numbers, some of which are zero. Move every zero to the end
of the row, keeping the non-zero numbers in the order they already have.

Change the row you are given. Nothing is returned.

## Input

- `slots` — a list of integers, changed in place

## Output

Nothing. After the call, `slots` holds its non-zero values in their original
order, followed by all of its zeroes.

## Constraints

- `1 <= slots.length <= 10^4`
- `-10^9 <= slots[i] <= 10^9`
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `slots = [0, 1, 0, 3, 12]`

Output: `slots` becomes `[1, 3, 12, 0, 0]`

The non-zero values keep the order 1, 3, 12; the two zeroes go to the end.

### Example 2

Input: `slots = [0, 0, 0]`

Output: `slots` becomes `[0, 0, 0]`

Every value is a zero, so nothing moves.

### Example 3

Input: `slots = [4, 0, -7]`

Output: `slots` becomes `[4, -7, 0]`

Negative values are not zero, so they keep their place in the order.
