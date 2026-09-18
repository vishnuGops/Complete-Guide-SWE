Every value in the row appears exactly three times, except one, which appears
once. Report that one.

Use `O(1)` extra space.

## Input

- `values` — a list of integers where every value but one appears three times

## Output

The value that appears once.

## Constraints

- `1 <= values.length <= 3 · 10^4`
- `-2^31 <= values[i] <= 2^31 - 1`
- Exactly one value appears once; every other appears exactly three times.
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `values = [2, 2, 3, 2]`

Output: `3`

### Example 2

Input: `values = [0, 1, 0, 1, 0, 1, 99]`

Output: `99`

### Example 3

Input: `values = [-2, -2, 1, -2]`

Output: `1`

## Notes

Exclusive-or cancels in *pairs*, so it does not work here directly: three copies
of a value xor together to that value, not to zero. The counting has to be done
per bit, and in threes.
