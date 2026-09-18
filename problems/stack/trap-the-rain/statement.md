A row of columns of varying heights stands in the rain. Water collects in the
dips and is held there by the taller columns on either side; water above a column
with nothing taller to its left, or nothing taller to its right, runs off.

Report how many units of water the row holds.

## Input

- `heights` — the column heights, left to right; each column is one unit wide

## Output

The total units of water held.

## Constraints

- `0 <= heights.length <= 10^4`
- `0 <= heights[i] <= 10^4`

## Examples

### Example 1

Input: `heights = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]`

Output: `6`

### Example 2

Input: `heights = [3, 2, 1]`

Output: `0`

The row only falls, so nothing is held.

### Example 3

Input: `heights = [2, 0, 2]`

Output: `2`

Two units sit in the dip between the two columns of height 2.

## Notes

Recomputing the tallest column to the left and to the right for every position is
`O(n^2)`. At the stated maximum that is a hundred million comparisons and it will
not finish.
