Report every ordering of the given values.

The values are all different. The orderings may be reported in any order, but
each one is itself a sequence and its order matters.

## Input

- `values` — a list of distinct integers

## Output

Every ordering, as a list of lists.

## Constraints

- `1 <= values.length <= 7`
- `-10^9 <= values[i] <= 10^9`
- All values are distinct.

## Examples

### Example 1

Input: `values = [1, 2, 3]`

Output: `[[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]`

Six orderings, in any order.

### Example 2

Input: `values = [0]`

Output: `[[0]]`

### Example 3

Input: `values = [5, 9]`

Output: `[[5,9], [9,5]]`
