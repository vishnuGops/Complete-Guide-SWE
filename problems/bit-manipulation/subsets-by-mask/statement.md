Report every subset of the given values — but in a specific order, and without
recursion.

Number the subsets from `0` to `2^n - 1`. Subset number `m` holds `values[i]`
exactly when bit `i` of `m` is set. Report the subsets in increasing order of
`m`, and within each subset report the values in increasing order of `i`.

## Input

- `values` — a list of distinct integers

## Output

All `2^n` subsets, in the order described.

## Constraints

- `1 <= values.length <= 14`
- `-10^9 <= values[i] <= 10^9`
- All values are distinct.

## Examples

### Example 1

Input: `values = [1, 2, 3]`

Output: `[[], [1], [2], [1,2], [3], [1,3], [2,3], [1,2,3]]`

Subset 5 is `101` in binary, so it holds `values[0]` and `values[2]`.

### Example 2

Input: `values = [7]`

Output: `[[], [7]]`

### Example 3

Input: `values = [9, 4]`

Output: `[[], [9], [4], [9, 4]]`

The order follows the masks, not the values — `[4]` is subset 2 and comes after
`[9]`, which is subset 1.
