Readings arrive one per minute. Every time the window of the last `k` readings
is full, report its median.

The median of `k` readings is the middle one once they are sorted when `k` is
odd, and the average of the two middle ones when `k` is even.

## Input

- `readings` — a list of integers, in arrival order
- `k` — the window length

## Output

A list of `readings.length - k + 1` numbers. Position `i` is the median of
`readings[i .. i + k - 1]`.

Answers within `10^-6` of the expected value are accepted.

## Constraints

- `1 <= k <= readings.length <= 10^4`
- `-10^9 <= readings[i] <= 10^9`

## Examples

### Example 1

Input: `readings = [1, 3, -1, -3, 5, 3, 6, 7]`, `k = 3`

Output: `[1, -1, -1, 3, 5, 6]`

The first window is `[1, 3, -1]`, which sorts to `[-1, 1, 3]`, so its median is

1. The second is `[3, -1, -3]`, sorting to `[-3, -1, 3]`, median -1.

### Example 2

Input: `readings = [4, 2, 8, 6]`, `k = 2`

Output: `[3, 5, 7]`

With an even window the median is the average of the two readings, and that
average need not be a whole number.

### Example 3

Input: `readings = [7, 7, 7]`, `k = 3`

Output: `[7]`

There is one full window, and every reading in it is the same.

## Notes

Sorting each window costs `O(k log k)` and there are `n - k + 1` of them. At the
stated maximum with `k` near `n / 2` that is hundreds of millions of
comparisons, and it will not finish. Aim for `O(log k)` per step.
