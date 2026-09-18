A crate holds cells that are empty (`0`), fresh (`1`) or already spoiled (`2`).

Every minute, each spoiled cell spoils the fresh cells directly above, below,
left and right of it. Empty cells block nothing and carry nothing — they are
simply gaps.

Report how many minutes pass before nothing fresh is left. If some fresh cell can
never spoil, report `-1`. If nothing is fresh to begin with, the answer is `0`.

## Input

- `crate` — a rectangular grid where each cell is `0`, `1` or `2`

## Output

The number of minutes until no fresh cell remains, or `-1`.

## Constraints

- `1 <= crate.length <= 100`
- `1 <= crate[0].length <= 100`
- Every row has the same length.
- Each cell is `0`, `1` or `2`.

## Examples

### Example 1

Input: `crate = [[2, 1, 1], [1, 1, 0], [0, 1, 1]]`

Output: `4`

### Example 2

Input: `crate = [[2, 1, 1], [0, 1, 1], [1, 0, 1]]`

Output: `-1`

The bottom-left cell is fresh and cut off from every spoiled one.

### Example 3

Input: `crate = [[0, 2]]`

Output: `0`

Nothing is fresh, so no time passes.
