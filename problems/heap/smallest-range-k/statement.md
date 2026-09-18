You are given `k` series of readings, each already in ascending order and none of
them empty.

Find the narrowest range `[low, high]` that contains at least one reading from
every series. A range's width is `high - low`.

If several ranges are equally narrow, report the one with the smallest `low`.

## Input

- `series` — a list of non-empty lists, each sorted ascending

## Output

A list of two integers, `[low, high]`.

## Constraints

- `1 <= series.length <= 3000`
- `1 <= readings in each series`, and at most `10^4` readings in total
- `-10^5 <= reading <= 10^5`

## Examples

### Example 1

Input: `series = [[4, 10, 15, 24], [0, 9, 12, 20], [5, 18, 22, 30]]`

Output: `[20, 24]`

24 is in the first, 20 in the second and 22 in the third, and no narrower range
covers all three.

### Example 2

Input: `series = [[1, 2, 3], [1, 2, 3], [1, 2, 3]]`

Output: `[1, 1]`

A single value appears in every series, so the range has width zero.

### Example 3

Input: `series = [[5]]`

Output: `[5, 5]`

One series, one reading.

## Notes

Trying every pair of endpoints is `O(N^2)` before you even check coverage. The
answer is a walk over the merged readings, and there are `N` of them.
