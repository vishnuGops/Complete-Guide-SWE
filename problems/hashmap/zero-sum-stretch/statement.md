A meter reports a signed change every minute. A stretch of minutes *cancels out*
when its changes add up to exactly zero.

Count the stretches that cancel out. A stretch is an unbroken run of at least
one minute, and two stretches are different when they start or end at different
minutes — even if they cover the same values.

## Input

- `changes` — a list of integers, in time order

## Output

The number of non-empty contiguous stretches of `changes` summing to zero.

## Constraints

- `1 <= changes.length <= 10^4`
- `-10^4 <= changes[i] <= 10^4`

## Examples

### Example 1

Input: `changes = [1, -1, 3, -3]`

Output: `3`

`[1, -1]`, `[3, -3]` and the whole row `[1, -1, 3, -3]`.

### Example 2

Input: `changes = [0, 0, 0]`

Output: `6`

Every one of the three single zeroes, both adjacent pairs, and the whole row.

### Example 3

Input: `changes = [2, 3]`

Output: `0`

Nothing cancels: no single value is zero and the pair sums to 5.

## Notes

Summing every stretch is `O(n^2)` even with a running total. At the stated
maximum that is fifty million additions and it will not finish here.
