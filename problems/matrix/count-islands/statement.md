A map marks each cell as land (`1`) or water (`0`). An island is a group of land
cells joined edge to edge — up, down, left or right. Diagonal contact does not
join two cells.

Count the islands.

## Input

- `terrain` — a rectangular grid where each cell is `0` or `1`

## Output

The number of islands.

## Constraints

- `1 <= terrain.length <= 100`
- `1 <= terrain[0].length <= 100`
- Every row has the same length.
- Each cell is `0` or `1`.

## Examples

### Example 1

Input: `terrain = [[1, 1, 0], [0, 1, 0], [0, 0, 1]]`

Output: `2`

The three cells in the top left are one island; the bottom-right cell is another.
They touch only at a corner, which does not join them.

### Example 2

Input: `terrain = [[0, 0], [0, 0]]`

Output: `0`

No land, no islands.

### Example 3

Input: `terrain = [[1, 1], [1, 1]]`

Output: `1`

All four cells are joined.
