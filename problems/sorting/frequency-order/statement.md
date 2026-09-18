A log holds a value per entry. Report the distinct values ordered by how often
they occur, most frequent first.

When two values occur equally often, the smaller value comes first.

## Input

- `values` - a list of integers, possibly with repeats

## Output

The distinct values, ordered by descending count and then by ascending value.

## Constraints

- `0 <= values.length <= 10000`
- `-10^9 <= values[i] <= 10^9`
- Every distinct value appears exactly once in the result.

## Examples

### Example 1

Input: `values = [4, 4, 1, 2, 2, 2]`

Output: `[2, 4, 1]`

`2` occurs three times, `4` twice, `1` once.

### Example 2

Input: `values = [5, 5, 3, 3]`

Output: `[3, 5]`

Both occur twice, so the smaller value leads.

### Example 3

Input: `values = []`

Output: `[]`

An empty log has no distinct values.
