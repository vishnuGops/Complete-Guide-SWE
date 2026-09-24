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

Input: `points = [[2, 4], [-3, 1]]`, `k = 1`

Output: `[[-3, 1]]`

`[-3, 1]` is `sqrt(10)` from the origin and `[2, 4]` is `sqrt(20)`.

### Example 2

Input: `points = [[4, 1], [-2, -5], [1, -3]]`, `k = 2`

Output: `[[1, -3], [4, 1]]`

The distances squared are 17, 29 and 10, so `[1, -3]` comes first and `[4, 1]`
second.

### Example 3

Input: `points = [[1, 0], [0, 1]]`, `k = 2`

Output: `[[0, 1], [1, 0]]`

Both are one away, so the smaller `x` comes first.

## Notes

There is no need for a square root anywhere. Comparing `x² + y²` orders the
points exactly as comparing the distances would, and does it in exact integer
arithmetic.
