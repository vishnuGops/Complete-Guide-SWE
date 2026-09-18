Every value in the row appears exactly twice, except two values, which each
appear once. Report those two, smaller first.

Use `O(1)` extra space.

## Input

- `values` — a list of integers where every value but two appears twice

## Output

The two values that appear once, in ascending order.

## Constraints

- `2 <= values.length <= 10^5`, and the length is even.
- `-10^9 <= values[i] <= 10^9`
- Exactly two values appear once; every other appears exactly twice.
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `values = [1, 2, 1, 3, 2, 5]`

Output: `[3, 5]`

### Example 2

Input: `values = [-1, 0]`

Output: `[-1, 0]`

### Example 3

Input: `values = [9, 9, 4, 7]`

Output: `[4, 7]`
