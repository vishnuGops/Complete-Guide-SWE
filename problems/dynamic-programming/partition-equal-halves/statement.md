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

Input: `values = [1, 5, 11, 5]`

Output: `true`

`[1, 5, 5]` and `[11]`, both totalling 11.

### Example 2

Input: `values = [1, 2, 3, 5]`

Output: `false`

The total is 11, which is odd, so no division is possible.

### Example 3

Input: `values = [2, 2]`

Output: `true`

## Notes

Trying every division is `2^n` — at two hundred values that is beyond
astronomical. The question turns out not to need them.
