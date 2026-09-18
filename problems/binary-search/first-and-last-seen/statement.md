The readings are sorted from smallest to largest, with duplicates allowed.
Report the first and last positions at which `target` appears.

If the target does not appear at all, report `[-1, -1]`.

## Input

- `readings` — a list of integers, sorted ascending
- `target` — the value to find

## Output

A list of two integers: the smallest and largest index holding `target`, or
`[-1, -1]`.

## Constraints

- `0 <= readings.length <= 10^5`
- `-10^9 <= readings[i] <= 10^9`
- `-10^9 <= target <= 10^9`
- `readings` is sorted ascending.

## Examples

### Example 1

Input: `readings = [5, 7, 7, 8, 8, 10]`, `target = 8`

Output: `[3, 4]`

The 8s occupy positions 3 and 4.

### Example 2

Input: `readings = [5, 7, 7, 8, 8, 10]`, `target = 6`

Output: `[-1, -1]`

There is no 6.

### Example 3

Input: `readings = [2, 2, 2]`, `target = 2`

Output: `[0, 2]`

Every position holds the target.

## Notes

Finding one occurrence and then walking outwards is `O(n)` when the target fills
the row, which is exactly the case the constraints allow.
