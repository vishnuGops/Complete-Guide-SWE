Maintenance windows are booked as `[start, end]` with `start <= end`, and they
arrive in no particular order. Two windows that overlap - or that merely touch,
like `[1, 4]` and `[4, 5]` - are really one longer outage.

Merge them and return the result **sorted by start**.

## Input

- `windows` - a list of `[start, end]` pairs, each with `start <= end`, in any
  order

## Output

The merged windows, sorted by start. No two windows in the result overlap or
touch.

## Constraints

- `0 <= windows.length <= 6000`
- `-10^9 <= start <= end <= 10^9`
- Windows that share only an endpoint count as overlapping and must be merged.

## Examples

### Example 1

Input: `windows = [[1, 3], [2, 6], [8, 10], [15, 18]]`

Output: `[[1, 6], [8, 10], [15, 18]]`

`[1, 3]` and `[2, 6]` overlap and become `[1, 6]`. The other two touch nothing.

### Example 2

Input: `windows = [[1, 4], [4, 5]]`

Output: `[[1, 5]]`

They share the instant `4`, which is enough to make them one outage.

### Example 3

Input: `windows = []`

Output: `[]`

Nothing booked, nothing to merge.
