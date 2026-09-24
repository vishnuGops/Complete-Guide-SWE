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

Input: `heights = [4, 1, 3, 0, 2, 5, 1, 2]`

Output: `11`

Between the 4 and the 5 the water rises to height 4, the lower wall: 3 + 1 + 4

- 2 units. The column of height 1 between the 5 and the last 2 holds one more.

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
`O(n^2)`. At the stated maximum that is a hundred million comparisons: too slow
for the time limit in Python, though Java's JIT gets through it. Either way it
misses the `O(n)` target.
