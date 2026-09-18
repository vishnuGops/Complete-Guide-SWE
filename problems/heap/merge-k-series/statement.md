You are given `k` series of readings, each already in ascending order. Merge them
into one ascending list.

## Input

- `series` — a list of lists, each sorted ascending; individual series may be
  empty, and the outer list may be empty

## Output

Every reading from every series, in ascending order.

## Constraints

- `0 <= series.length <= 10^4`
- `0 <= total readings across all series <= 10^4`
- `-10^9 <= reading <= 10^9`

## Examples

### Example 1

Input: `series = [[1, 4, 5], [1, 3, 4], [2, 6]]`

Output: `[1, 1, 2, 3, 4, 4, 5, 6]`

### Example 2

Input: `series = []`

Output: `[]`

### Example 3

Input: `series = [[], [1], []]`

Output: `[1]`

## Notes

Merging the series one at a time into a growing result re-walks everything
already merged, which is `O(k · N)`. At the stated maxima — ten thousand series
of one reading each — that is fifty million steps and will not finish.
