Read every cell of a grid in a spiral: the top row left to right, the right-hand
column top to bottom, the bottom row right to left, the left-hand column bottom
to top, then inwards and around again.

## Input

- `grid` — a rectangular grid of integers

## Output

Every value in the grid, in spiral order, as a single list.

## Constraints

- `1 <= grid.length <= 100`
- `1 <= grid[0].length <= 100`
- Every row has the same length.
- `-10^9 <= grid[i][j] <= 10^9`

## Examples

### Example 1

Input: `grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]`

Output: `[1, 2, 3, 6, 9, 8, 7, 4, 5]`

Around the outside, then the single cell left in the middle.

### Example 2

Input: `grid = [[1, 2, 3, 4]]`

Output: `[1, 2, 3, 4]`

A single row is read left to right and then there is nothing left.

### Example 3

Input: `grid = [[1], [2], [3]]`

Output: `[1, 2, 3]`

A single column is read top to bottom.

## Notes

Examples 2 and 3 are where most attempts break: after the top row of a
one-row grid there is no bottom row to come back along, and after the right
column of a one-column grid there is no left column.
