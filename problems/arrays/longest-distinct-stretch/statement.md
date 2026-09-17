A quality report wants the longest stretch of consecutive readings that uses at
most `limit` different values. A stretch is any run of neighbouring readings, and
its length is how many readings it contains.

Return the length of the longest such stretch.

## Input

- `values` - a list of integers, the readings in order
- `limit` - the largest number of distinct values the stretch may contain

## Output

The length of the longest stretch containing at most `limit` distinct values.

## Constraints

- `1 <= values.length <= 10000`
- `1 <= limit <= 1000`
- `0 <= values[i] <= 10^9`
- `limit` may be larger than the number of distinct values present, in which case
  the whole list qualifies.
- Checking every stretch separately is `O(n^2)` and will not finish in time.

## Examples

### Example 1

Input: `values = [1, 2, 1, 3, 4]`, `limit = 2`
Output: `3`

`[1, 2, 1]` uses two distinct values and is three long. Extending it to include
`3` would need three.

### Example 2

Input: `values = [5, 5, 5]`, `limit = 1`
Output: `3`

Every reading is the same, so one distinct value covers the whole list.

### Example 3

Input: `values = [1, 2, 3]`, `limit = 5`
Output: `3`

The allowance is larger than the number of distinct values, so nothing is
excluded.
