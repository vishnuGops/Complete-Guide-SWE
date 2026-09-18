The row holds `n` different numbers drawn from `0` to `n`, in any order — so
exactly one of those `n + 1` numbers is missing.

Report the missing one.

## Input

- `values` — `n` distinct integers, each between `0` and `n`

## Output

The number between `0` and `n` that is not in the row.

## Constraints

- `1 <= values.length <= 10^5`
- Every value is between `0` and `values.length`, and no value repeats.
- You may use only `O(1)` extra space.

## Examples

### Example 1

Input: `values = [3, 0, 1]`

Output: `2`

The numbers 0 to 3, missing the 2.

### Example 2

Input: `values = [0]`

Output: `1`

### Example 3

Input: `values = [1]`

Output: `0`
