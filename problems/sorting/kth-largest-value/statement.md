Report the `k`-th largest reading, counting duplicates as separate readings. The
1st largest is the maximum; the 2nd largest of `[5, 5, 3]` is `5`, not `3`.

## Input

- `readings` — a list of integers, in no particular order
- `k` — which largest reading to report, counting from 1

## Output

The `k`-th largest value in `readings`.

## Constraints

- `1 <= k <= readings.length <= 10^5`
- `-10^9 <= readings[i] <= 10^9`

## Examples

### Example 1

Input: `readings = [3, 2, 1, 5, 6, 4]`, `k = 2`

Output: `5`

Sorted downwards the readings are 6, 5, 4, 3, 2, 1, and the second is 5.

### Example 2

Input: `readings = [5, 5, 3]`, `k = 2`

Output: `5`

Duplicates count separately, so the second largest is the other 5.

### Example 3

Input: `readings = [7]`, `k = 1`

Output: `7`

One reading is its own largest.

## Notes

Pulling the maximum out `k` times is `O(n·k)`. At the stated maximum with `k`
near `n / 2` that is billions of comparisons and will not finish.
