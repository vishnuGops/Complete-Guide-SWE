Given a scattered pile of ticket numbers, find the longest run of consecutive
numbers the pile contains. The numbers are in no particular order, and a number
that appears twice does not lengthen a run.

Return the length of the longest run.

## Input

- `values` - a list of integers in any order, possibly with duplicates

## Output

The length of the longest run of consecutive integers present in the list.

## Constraints

- `0 <= values.length <= 10000`
- `-10^9 <= values[i] <= 10^9`
- An empty pile has no run, so its answer is `0`.

## Examples

### Example 1

Input: `values = [31, 6, 8, 40, 7, 5, 30]`

Output: `4`

`5, 6, 7, 8` are all present, and the only other run, `30, 31`, is shorter.

### Example 2

Input: `values = []`

Output: `0`

There is nothing to run.

### Example 3

Input: `values = [7, 7, 7]`

Output: `1`

Duplicates do not extend a run; the longest is just `7` itself.
