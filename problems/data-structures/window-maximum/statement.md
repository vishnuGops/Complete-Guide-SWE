Readings arrive one per minute. Every time the window of the last `k` readings is
full, report its largest reading.

## Input

- `readings` — a list of integers, in arrival order
- `k` — the window length

## Output

A list of `readings.length - k + 1` integers: position `i` is the largest of
`readings[i .. i + k - 1]`.

## Constraints

- `1 <= k <= readings.length <= 10^5`
- `-10^9 <= readings[i] <= 10^9`

## Examples

### Example 1

Input: `readings = [1, 3, -1, -3, 5, 3, 6, 7]`, `k = 3`

Output: `[3, 3, 5, 5, 6, 7]`

### Example 2

Input: `readings = [9]`, `k = 1`

Output: `[9]`

### Example 3

Input: `readings = [7, 7, 7]`, `k = 2`

Output: `[7, 7]`

## Notes

Scanning each window costs `O(k)`, so `O(n·k)` overall — ten billion comparisons
at the stated maximum with `k` near `n / 2`, which will not finish. A heap gets
it to `O(n log k)`; the answer below is `O(n)`.
