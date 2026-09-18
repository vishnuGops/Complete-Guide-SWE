Report the `k` points closest to the origin.

Order the answer by distance, nearest first. When two points are the same
distance away, the one with the smaller `x` comes first; if those are equal too,
the one with the smaller `y`.

## Input

- `points` — a list of `[x, y]` pairs
- `k` — how many points to report

## Output

The `k` nearest points, in the order described.

## Constraints

- `1 <= k <= points.length <= 10^5`
- `-10^4 <= x, y <= 10^4`

## Examples

### Example 1

Input: `points = [[1, 3], [-2, 2]]`, `k = 1`

Output: `[[-2, 2]]`

`[-2, 2]` is `sqrt(8)` from the origin and `[1, 3]` is `sqrt(10)`.

### Example 2

Input: `points = [[3, 3], [5, -1], [-2, 4]]`, `k = 2`

Output: `[[3, 3], [-2, 4]]`

The distances squared are 18, 26 and 20.

### Example 3

Input: `points = [[1, 0], [0, 1]]`, `k = 2`

Output: `[[0, 1], [1, 0]]`

Both are one away, so the smaller `x` comes first.

## Notes

There is no need for a square root anywhere. Comparing `x² + y²` orders the
points exactly as comparing the distances would, and does it in exact integer
arithmetic.
