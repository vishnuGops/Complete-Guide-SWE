Report the `k` values that occur most often.

Order the answer by how often each value occurs, most frequent first. When two
values occur equally often, the smaller value comes first.

## Input

- `readings` — a list of integers
- `k` — how many values to report

## Output

The `k` most frequent values, in the order described.

## Constraints

- `1 <= readings.length <= 10^5`
- `-10^9 <= readings[i] <= 10^9`
- `1 <= k <= the number of distinct values in readings`

## Examples

### Example 1

Input: `readings = [1, 1, 1, 2, 2, 3]`, `k = 2`

Output: `[1, 2]`

1 occurs three times and 2 twice.

### Example 2

Input: `readings = [5, 5, 4, 4, 3]`, `k = 2`

Output: `[4, 5]`

4 and 5 both occur twice, so the smaller one comes first.

### Example 3

Input: `readings = [7]`, `k = 1`

Output: `[7]`
