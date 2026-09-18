The readings are already sorted from smallest to largest. Report the `k` of them
closest to a `target` value, in ascending order.

Closeness is the absolute difference. When two readings are equally close, the
smaller one wins.

## Input

- `readings` — a list of integers, sorted ascending
- `k` — how many readings to report
- `target` — the value to be close to

## Output

The `k` closest readings, in ascending order.

## Constraints

- `1 <= k <= readings.length <= 10^4`
- `-10^9 <= readings[i] <= 10^9`
- `-10^9 <= target <= 10^9`
- `readings` is sorted ascending and may contain duplicates.

## Examples

### Example 1

Input: `readings = [1, 2, 3, 4, 5]`, `k = 4`, `target = 3`

Output: `[1, 2, 3, 4]`

The distances are 2, 1, 0, 1, 2. Four are wanted, and the tie between 1 and 5 —
both two away — goes to the smaller.

### Example 2

Input: `readings = [1, 2, 3, 4, 5]`, `k = 4`, `target = -1`

Output: `[1, 2, 3, 4]`

The target sits below everything, so the closest readings are the first four.

### Example 3

Input: `readings = [10, 20, 30]`, `k = 1`, `target = 21`

Output: `[20]`

21 is one away from 20 and nine away from 30.

## Notes

The answer is always a contiguous run of `readings`. That is worth proving to
yourself before writing anything.
