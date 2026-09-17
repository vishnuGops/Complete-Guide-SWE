A series of distinct readings was stored in ascending order and then rotated left
by an unknown amount, so `[1, 3, 5, 6, 7, 9]` might be stored as
`[6, 7, 9, 1, 3, 5]`. The rotation amount is not given, and it may be zero.

Find a target reading and return its index, or `-1` if it is not there.

## Input

- `values` - a list of **distinct** integers: an ascending series rotated left by
  an unknown amount
- `target` - the reading to find

## Output

The index of `target` in `values`, or `-1`.

## Constraints

- `0 <= values.length <= 2000`
- `-10^9 <= values[i] <= 10^9`, all distinct

## Examples

### Example 1

Input: `values = [6, 7, 9, 1, 3, 5]`, `target = 1`
Output: `3`

The series was rotated so that it starts at `6`; `1` sits at index 3.

### Example 2

Input: `values = [6, 7, 9, 1, 3, 5]`, `target = 4`
Output: `-1`

`4` is not in the series.

### Example 3

Input: `values = [3]`, `target = 3`
Output: `0`

A single reading is a rotation of itself.
