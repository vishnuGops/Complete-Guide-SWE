A plan marks each cell as open (`0`) or wall (`1`). Open cells joined edge to
edge form a region.

Fill in — set to `1` — every open cell that cannot reach the outside. A region
reaches the outside if any of its cells lies on the edge of the plan.

Change the plan you are given. Nothing is returned.

## Input

- `plan` — a rectangular grid where each cell is `0` or `1`, changed in place

## Output

Nothing. After the call, every enclosed open cell is a wall; open cells that
touch the edge, and everything joined to them, are untouched.

## Constraints

- `1 <= plan.length <= 100`
- `1 <= plan[0].length <= 100`
- Every row has the same length.
- Each cell is `0` or `1`.

## Examples

### Example 1

Input: `plan = [[1, 1, 1], [1, 0, 1], [1, 1, 1]]`

Output: `plan` becomes `[[1, 1, 1], [1, 1, 1], [1, 1, 1]]`

The single open cell is walled in on all four sides.

### Example 2

Input: `plan = [[1, 1, 1], [1, 0, 1], [1, 0, 1]]`

Output: unchanged

The lower open cell is on the bottom edge, so both cells can reach the outside.

### Example 3

Input: `plan = [[0]]`

Output: unchanged

A one-cell plan is entirely edge.

## Notes

Cells are joined up, down, left and right only. A gap that is only diagonal does
not let a region out.
