A climb log rises strictly to a single highest reading and then falls strictly
away from it. Report the position of that highest reading.

Strictly means no two neighbouring readings are equal: the row goes up, up, up,
then down, down, down, with exactly one turning point, and the turning point is
neither the first nor the last position.

## Input

- `readings` — a list of integers that rises strictly then falls strictly

## Output

The index of the largest reading.

## Constraints

- `3 <= readings.length <= 10^5`
- `-10^9 <= readings[i] <= 10^9`
- There is exactly one position `p` with `0 < p < readings.length - 1` such that
  `readings` strictly increases up to `p` and strictly decreases after it.

## Examples

### Example 1

Input: `readings = [1, 3, 5, 4, 2]`

Output: `2`

The readings rise to 5 at position 2, then fall.

### Example 2

Input: `readings = [0, 10, 9]`

Output: `1`

The shortest possible climb log.

### Example 3

Input: `readings = [-5, -4, -3, -9]`

Output: `2`

Negative readings behave no differently; -3 is the largest.

## Notes

Reading every value is `O(n)` and obviously correct. The reason to do better is
the same reason binary search exists: the shape of the row tells you which half
the answer is in without looking at the other half.
