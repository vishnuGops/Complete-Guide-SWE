The readings are sorted from smallest to largest. Report the position a new
`target` would occupy if it were inserted while keeping the row sorted.

If the target is already present, report the position of its first occurrence —
inserting there keeps the row sorted and puts the new copy ahead of the old
ones.

## Input

- `readings` — a list of integers, sorted ascending, possibly with duplicates
- `target` — the value to place

## Output

The smallest index `i` such that `readings[i] >= target`, or `readings.length`
if the target belongs after everything.

## Constraints

- `0 <= readings.length <= 10^4`
- `-10^9 <= readings[i] <= 10^9`
- `-10^9 <= target <= 10^9`
- `readings` is sorted ascending.

## Examples

### Example 1

Input: `readings = [1, 3, 5, 6]`, `target = 5`

Output: `2`

5 is already at position 2.

### Example 2

Input: `readings = [1, 3, 5, 6]`, `target = 2`

Output: `1`

2 belongs between 1 and 3.

### Example 3

Input: `readings = [1, 3, 5, 6]`, `target = 7`

Output: `4`

7 belongs after everything, which is the position one past the end.
