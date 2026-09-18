Every value in the row appears exactly twice, except one, which appears once.
Report that one.

Use `O(1)` extra space.

## Input

- `values` — a list of integers where every value but one appears twice

## Output

The value that appears once.

## Constraints

- `1 <= values.length <= 10^5`, and the length is odd.
- `-10^9 <= values[i] <= 10^9`
- Exactly one value appears once; every other appears exactly twice.
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `values = [4, 1, 2, 1, 2]`

Output: `4`

### Example 2

Input: `values = [7]`

Output: `7`

### Example 3

Input: `values = [-3, 5, 5]`

Output: `-3`
