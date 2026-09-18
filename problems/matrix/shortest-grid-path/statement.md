A floor plan marks each cell as open (`0`) or blocked (`1`). You start at the
top-left cell and want to reach the bottom-right one, stepping only up, down,
left or right onto open cells.

Report the number of cells on the shortest such route, counting both ends. If
there is no route — or either end is blocked — report `-1`.

## Input

- `plan` — a rectangular grid where each cell is `0` (open) or `1` (blocked)

## Output

The number of cells on the shortest route, or `-1`.

## Constraints

- `1 <= plan.length <= 100`
- `1 <= plan[0].length <= 100`
- Every row has the same length.
- Each cell is `0` or `1`.

## Examples

### Example 1

Input: `plan = [[0, 0, 0], [1, 1, 0], [0, 0, 0]]`

Output: `5`

Right, right, down, down — five cells including both ends.

### Example 2

Input: `plan = [[0, 1], [1, 0]]`

Output: `-1`

The two open cells touch only at a corner, and diagonal steps are not allowed.

### Example 3

Input: `plan = [[0]]`

Output: `1`

The start is the finish, and it counts as one cell.
