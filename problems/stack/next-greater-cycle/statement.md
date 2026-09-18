The readings are arranged in a ring: after the last one comes the first again.

For each reading, report the first reading strictly greater than it, searching
forwards around the ring. If no reading anywhere is greater, report `-1`.

## Input

- `readings` — a list of integers, understood as a ring

## Output

A list of the same length, holding each reading's next greater reading, or `-1`.

## Constraints

- `1 <= readings.length <= 10^4`
- `-10^9 <= readings[i] <= 10^9`

## Examples

### Example 1

Input: `readings = [1, 2, 1]`

Output: `[2, -1, 2]`

The last 1 finds the 2 by wrapping around to the start.

### Example 2

Input: `readings = [5, 5, 5]`

Output: `[-1, -1, -1]`

Nothing is *strictly* greater than anything else.

### Example 3

Input: `readings = [3, 8, 4, 1, 2]`

Output: `[8, -1, 8, 2, 3]`

The 1 finds the 2 immediately after it, and the 2 wraps around to the 3 — the
first reading greater than it, not the largest one.

## Notes

The search is forwards only. A reading never looks backwards, even though the
ring makes "backwards far enough" the same as "forwards far enough".
