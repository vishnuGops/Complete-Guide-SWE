Return a new row holding every even reading first, then every odd one, with both
groups keeping the order they arrived in.

This is the same rule as `even-odd-partition`, asked the other way round: there,
you rearranged the row in place; here you build a new one, and the interesting
question is what a *sort* has to promise for this to work.

Zero is even. `-4` is even and `-7` is odd.

## Input

- `readings` — a list of integers, in arrival order

## Output

A new list: the even readings in arrival order, followed by the odd readings in
arrival order. The input is not changed.

## Constraints

- `1 <= readings.length <= 10^4`
- `-10^9 <= readings[i] <= 10^9`

## Examples

### Example 1

Input: `readings = [3, 8, 5, 4, 1, 6]`

Output: `[8, 4, 6, 3, 5, 1]`

The evens are 8, 4, 6 in that order; the odds are 3, 5, 1 in theirs.

### Example 2

Input: `readings = [2, 4, 6]`

Output: `[2, 4, 6]`

Everything is even, so nothing moves.

### Example 3

Input: `readings = [-7, 0, -4]`

Output: `[0, -4, -7]`

Zero and -4 are even; -7 is odd and goes to the back.
