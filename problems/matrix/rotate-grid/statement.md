Turn a square grid a quarter turn clockwise, in place. The top row becomes the
right-hand column, the right-hand column becomes the bottom row, and so on.

Change the grid you are given. Nothing is returned, and you may not allocate a
second grid.

## Input

- `grid` — a square grid of integers, changed in place

## Output

Nothing. After the call, `grid` holds its quarter turn clockwise.

## Constraints

- `1 <= grid.length <= 100`
- `grid` is square: every row is as long as the grid is tall.
- `-10^9 <= grid[i][j] <= 10^9`
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `grid = [[1, 2], [3, 4]]`

Output: `grid` becomes `[[3, 1], [4, 2]]`

### Example 2

Input: `grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]`

Output: `grid` becomes `[[7, 4, 1], [8, 5, 2], [9, 6, 3]]`

The first column, read upwards, becomes the first row.

### Example 3

Input: `grid = [[5]]`

Output: `grid` becomes `[[5]]`

A single cell turns to itself.
