A sorted series of distinct readings has been rotated: some number of readings
were taken off the front and appended to the back, so `[1, 2, 3, 4, 5]` might
arrive as `[3, 4, 5, 1, 2]`.

Report the position of the smallest reading — the point where the series turns.
A series that was rotated zero times turns at position 0.

## Input

- `readings` — a rotation of a strictly ascending list of distinct integers

## Output

The index of the smallest reading.

## Constraints

- `1 <= readings.length <= 10^5`
- `-10^9 <= readings[i] <= 10^9`
- All readings are distinct.

## Examples

### Example 1

Input: `readings = [3, 4, 5, 1, 2]`

Output: `3`

The smallest reading, 1, sits at position 3.

### Example 2

Input: `readings = [1, 2, 3]`

Output: `0`

The series was not rotated, so it turns at the start.

### Example 3

Input: `readings = [2, 1]`

Output: `1`

A rotation by one.

## Notes

The row is not sorted, so a plain binary search for a value does not apply. What
does apply is the comparison that tells you which half you are in.
