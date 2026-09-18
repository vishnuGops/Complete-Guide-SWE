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

Input: `balloons = [3, 1, 5, 8]`

Output: `167`

Burst the 1 (3·1·5 = 15), then the 5 (3·5·8 = 120), then the 3 (1·3·8 = 24),
then the 8 (1·8·1 = 8).

### Example 2

Input: `balloons = [7]`

Output: `7`

Both neighbours are missing, so the score is 1·7·1.

### Example 3

Input: `balloons = [1, 5]`

Output: `10`

Burst the 1 first (1·1·5 = 5), then the 5 (1·5·1 = 5).

## Notes

Every order is `n!` orders, and the obvious recursion — try each balloon first —
does not decompose, because bursting a balloon changes who is next to whom
everywhere in the row.
