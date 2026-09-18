A sensor logs a reading every minute. A repeat is only worth reporting if it
happened recently: two equal readings matter when they are at most `k` minutes
apart.

Report whether the log contains two equal readings at positions `i` and `j` with
`i != j` and `|i - j| <= k`.

## Input

- `readings` — a list of integers, in arrival order
- `k` — how far apart two equal readings may be and still count

## Output

`true` if such a pair exists, `false` otherwise.

## Constraints

- `1 <= readings.length <= 10^4`
- `-10^9 <= readings[i] <= 10^9`
- `0 <= k <= 10^4`

## Examples

### Example 1

Input: `readings = [1, 2, 3, 1]`, `k = 3`

Output: `true`

The two 1s are at positions 0 and 3, which is exactly 3 apart.

### Example 2

Input: `readings = [1, 2, 3, 1]`, `k = 2`

Output: `false`

The only repeat is 3 apart, which is further than allowed.

### Example 3

Input: `readings = [4, 4]`, `k = 0`

Output: `false`

`k = 0` would require two equal readings at the same position, and a position is
not a repeat of itself.

## Notes

The naive check compares every pair within reach. When `k` is large that is
`O(n·k)` comparisons, and at the stated maxima it is a hundred million of them.
