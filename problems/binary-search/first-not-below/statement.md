Readings are stored in non-decreasing order. Find where a threshold first gets
met: the index of the earliest reading that is **not below** the threshold.

If every reading is below the threshold, return the length of the list - the
position a matching reading would be inserted at.

## Input

- `values` - a list of integers sorted in non-decreasing order, possibly with
  repeats
- `threshold` - the value to meet or exceed

## Output

The smallest index `i` with `values[i] >= threshold`, or `values.length` if there
is none.

## Constraints

- `0 <= values.length <= 2000`
- `-10^9 <= values[i] <= 10^9`, sorted non-decreasing
- `-10^9 <= threshold <= 10^9`

## Examples

### Example 1

Input: `values = [1, 3, 5, 7]`, `threshold = 4`
Output: `2`

`5` is the first reading that is not below `4`.

### Example 2

Input: `values = [1, 3, 5, 7]`, `threshold = 8`
Output: `4`

Nothing meets the threshold, so the answer is the length of the list.

### Example 3

Input: `values = [2, 2, 2]`, `threshold = 2`
Output: `0`

Equal counts as meeting the threshold, and the **first** such index is wanted.
