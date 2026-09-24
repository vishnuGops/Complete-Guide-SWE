Report whether the values can be divided into two groups whose totals are equal.
Every value must go into exactly one group.

## Input

- `values` — a list of positive integers

## Output

`true` if such a division exists, `false` otherwise.

## Constraints

- `1 <= values.length <= 200`
- `1 <= values[i] <= 100`

## Examples

### Example 1

Input: `values = [2, 9, 4, 3]`

Output: `true`

`[2, 4, 3]` and `[9]`, both totalling 9.

### Example 2

Input: `values = [4, 6, 2, 3]`

Output: `false`

The total is 15, which is odd, so no division is possible.

### Example 3

Input: `values = [2, 2]`

Output: `true`

## Notes

Trying every division is `2^n` — at two hundred values that is beyond
astronomical. The question turns out not to need them.
