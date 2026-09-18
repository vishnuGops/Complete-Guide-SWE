A robot starts in the top-left cell of a grid and must reach the bottom-right
one, moving only right or down. Some cells are blocked and may not be entered.

Count the routes.

## Input

- `grid` — a rectangular grid where `0` is open and `1` is blocked

## Output

The number of routes from the top-left cell to the bottom-right one.

## Constraints

- `1 <= grid.length <= 15`
- `1 <= grid[0].length <= 15`
- Every row has the same length.
- Each cell is `0` or `1`.

## Examples

### Example 1

Input: `grid = [[0, 0, 0], [0, 1, 0], [0, 0, 0]]`

Output: `2`

Around the blocked middle cell, either way.

### Example 2

Input: `grid = [[0, 1], [0, 0]]`

Output: `1`

Down then right.

### Example 3

Input: `grid = [[1]]`

Output: `0`

The starting cell is blocked, so there is no route at all.
