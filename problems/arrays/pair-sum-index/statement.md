You are handed a row of integers and a target total. Exactly one pair of
positions in that row adds up to the target. Find it.

Return the two positions, smaller first. A value may not be paired with itself:
the two positions must be different, although the values sitting at them may
happen to be equal.

## Input

- `values` — a list of integers, `2 <= values.length <= 10^5`
- `target` — an integer, `-2 * 10^9 <= target <= 2 * 10^9`

## Output

A list of two integers: the indices of the pair, in ascending order.

## Constraints

- `2 <= values.length <= 10^5`
- `-10^9 <= values[i] <= 10^9`
- Exactly one pair of distinct indices sums to `target`.

## Examples

### Example 1

Input: `values = [4, 9]`, `target = 13`
Output: `[0, 1]`

There is only one pair to consider, and `4 + 9 == 13`.

### Example 2

Input: `values = [-8, -3, 5, 11]`, `target = -11`
Output: `[0, 1]`

`values[0] + values[1] == -8 + -3 == -11`. No other pair reaches `-11`.

### Example 3

Input: `values = [7, 7, 2]`, `target = 14`
Output: `[0, 1]`

The two sevens are at different positions, so they form a legal pair even though
their values are equal. Pairing index 0 with itself would not be allowed.
