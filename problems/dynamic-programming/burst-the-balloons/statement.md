A row of balloons each carries a number. Bursting a balloon scores its number
times the numbers of the balloons **immediately either side of it at that
moment** — and then the row closes up, so its neighbours become neighbours of
each other.

A missing neighbour, past either end of the row, counts as `1`.

Burst every balloon, in whatever order you like, and report the largest total
score.

## Input

- `balloons` — the numbers on the balloons, in a row

## Output

The largest total score.

## Constraints

- `1 <= balloons.length <= 300`
- `0 <= balloons[i] <= 100`

## Examples

### Example 1

Input: `balloons = [2, 4, 1, 6]`

Output: `90`

Burst the 1 (4·1·6 = 24), then the 4 (2·4·6 = 48), then the 2 (1·2·6 = 12),
then the 6 (1·6·1 = 6).

### Example 2

Input: `balloons = [7]`

Output: `7`

Both neighbours are missing, so the score is 1·7·1.

### Example 3

Input: `balloons = [3, 2]`

Output: `9`

Burst the 2 first (3·2·1 = 6), then the 3 (1·3·1 = 3). The other order scores
only 6 + 2 = 8.

## Notes

Every order is `n!` orders, and the obvious recursion — try each balloon first —
does not decompose, because bursting a balloon changes who is next to whom
everywhere in the row.
