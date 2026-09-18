Report every subset of the given values, including the empty subset and the whole
set.

The values are all different. Neither the order of the subsets nor the order
within a subset matters.

## Input

- `values` — a list of distinct integers

## Output

Every subset, as a list of lists.

## Constraints

- `1 <= values.length <= 12`
- `-10^9 <= values[i] <= 10^9`
- All values are distinct.

## Examples

### Example 1

Input: `values = [1, 2, 3]`

Output: `[[], [1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]`

Eight subsets, in any order.

### Example 2

Input: `values = [0]`

Output: `[[], [0]]`

### Example 3

Input: `values = [7, -7]`

Output: `[[], [7], [-7], [7, -7]]`
