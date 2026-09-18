A tuning tool looks for readings that sit a fixed distance apart. Count the
distinct **value pairs** `{a, b}` where both values occur in the list and
`b - a` equals `gap`.

Pairs are counted by value, not by position: a value that occurs five times still
contributes the same single pair. When `gap` is `0`, a pair means one value that
occurs at least twice.

## Input

- `values` - a list of integers, in any order, possibly with duplicates
- `gap` - a non-negative integer

## Output

The number of distinct value pairs whose difference is exactly `gap`.

## Constraints

- `0 <= values.length <= 10000`
- `-10^9 <= values[i] <= 10^9`
- `0 <= gap <= 10^9`

## Examples

### Example 1

Input: `values = [1, 5, 3, 4, 2]`, `gap = 2`

Output: `3`

The pairs are `{1, 3}`, `{2, 4}` and `{3, 5}`.

### Example 2

Input: `values = [1, 1, 2, 2]`, `gap = 0`

Output: `2`

A gap of zero needs a repeated value. Both `1` and `2` repeat, so there are two
pairs.

### Example 3

Input: `values = [1, 2, 3]`, `gap = 7`

Output: `0`

No two values are seven apart.
