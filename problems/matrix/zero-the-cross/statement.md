Wherever a grid holds a zero, blank that cell's entire row and entire column —
set every value in them to zero.

The rule applies to the zeroes that were in the grid **when you started**. A zero
written by the blanking does not itself cause more blanking.

Change the grid you are given. Nothing is returned.

## Input

- `grid` — a rectangular grid of integers, changed in place

## Output

Nothing. After the call, every row and column that originally held a zero is
entirely zero.

## Constraints

- `1 <= grid.length <= 100`
- `1 <= grid[0].length <= 100`
- Every row has the same length.
- `-10^9 <= grid[i][j] <= 10^9`
- Aim for `O(1)` extra space: the natural answer uses `O(rows + columns)`, and
  getting to constant space is the point of the problem.

## Examples

### Example 1

Input: `grid = [[1, 1, 1], [1, 0, 1], [1, 1, 1]]`

Output: `grid` becomes `[[1, 0, 1], [0, 0, 0], [1, 0, 1]]`

### Example 2

Input: `grid = [[0, 1], [1, 1]]`

Output: `grid` becomes `[[0, 0], [0, 1]]`

### Example 3

Input: `grid = [[1, 2], [3, 4]]`

Output: `grid` becomes `[[1, 2], [3, 4]]`

There is no zero, so nothing changes.

## Notes

The trap is not speed, it is the order of writes: blanking a row as soon as you
find a zero puts new zeroes in the grid, and reading them later blanks rows that
should have been left alone. Example 1 becomes all zeroes if you do that.
