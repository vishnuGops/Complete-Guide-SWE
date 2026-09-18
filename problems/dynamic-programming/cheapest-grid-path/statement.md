Each cell of a grid charges a toll. Starting at the top-left cell and moving only
right or down, reach the bottom-right cell for the smallest total toll.

The tolls of both the starting cell and the finishing cell are paid.

## Input

- `tolls` — a rectangular grid of non-negative integers

## Output

The smallest total toll of a route from the top-left cell to the bottom-right
one.

## Constraints

- `1 <= tolls.length <= 200`
- `1 <= tolls[0].length <= 200`
- Every row has the same length.
- `0 <= tolls[i][j] <= 100`

## Examples

### Example 1

Input: `tolls = [[1, 3, 1], [1, 5, 1], [4, 2, 1]]`

Output: `7`

1 → 3 → 1 → 1 → 1 along the top and down the right.

### Example 2

Input: `tolls = [[1, 2, 3]]`

Output: `6`

A single row leaves no choice.

### Example 3

Input: `tolls = [[5]]`

Output: `5`

The one cell is both the start and the finish, and its toll is paid once.
