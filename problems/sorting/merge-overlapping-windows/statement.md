Maintenance windows are booked as `[start, end]` with `start <= end`, and they
arrive in no particular order. Two windows that overlap - or that merely touch,
like `[3, 5]` and `[5, 8]` - are really one longer outage.

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

Input: `windows = [[2, 5], [4, 7], [9, 12], [15, 16]]`

Output: `[[2, 7], [9, 12], [15, 16]]`

`[2, 5]` and `[4, 7]` overlap and become `[2, 7]`. The other two touch nothing.

### Example 2

Input: `windows = [[2, 7], [7, 9]]`

Output: `[[2, 9]]`

They share the instant `7`, which is enough to make them one outage.

### Example 3

Input: `windows = []`

Output: `[]`

Nothing booked, nothing to merge.
