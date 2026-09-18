A grid is sorted twice over: each row runs left to right in ascending order, and
the first value of every row is greater than the last value of the row above it.

Report whether `target` appears in the grid.

## Input

- `grid` — a rectangular grid sorted as described
- `target` — the value to look for

## Output

`true` if `target` appears in the grid, `false` otherwise.

## Constraints

- `1 <= grid.length <= 100`
- `1 <= grid[0].length <= 100`
- Every row has the same length.
- `-10^9 <= grid[i][j] <= 10^9` and `-10^9 <= target <= 10^9`
- All values are distinct, and the grid is sorted as described.

## Examples

### Example 1

Input: `grid = [[1, 3, 5], [7, 9, 11]]`, `target = 9`

Output: `true`

### Example 2

Input: `grid = [[1, 3, 5], [7, 9, 11]]`, `target = 6`

Output: `false`

6 falls between the two rows and is in neither.

### Example 3

Input: `grid = [[1]]`, `target = 1`

Output: `true`

## Notes

Read the sorting condition carefully: it is stronger than "every row and every
column is sorted". The whole grid, read row by row, is one ascending sequence.
