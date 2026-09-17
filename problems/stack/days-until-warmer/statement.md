A weather log holds one temperature per day. For each day, report how many days
you would have to wait for a **strictly warmer** one.

If no later day is warmer, report `0` for that day.

## Input

- `temperatures` - a list of integers, one per day, in day order

## Output

A list of the same length. Entry `i` is the number of days from day `i` to the
first later day that is strictly warmer, or `0` if there is none.

## Constraints

- `0 <= temperatures.length <= 10000`
- `-100 <= temperatures[i] <= 100`
- Equal temperatures do not count as warmer.

## Examples

### Example 1

Input: `temperatures = [30, 40, 35, 50]`
Output: `[1, 2, 1, 0]`

Day 0 waits one day for `40`. Day 1 waits two for `50`. Day 2 waits one for `50`.
Day 3 never gets warmer.

### Example 2

Input: `temperatures = [5, 5, 5]`
Output: `[0, 0, 0]`

Equal is not warmer, so no day is ever answered.

### Example 3

Input: `temperatures = []`
Output: `[]`

No days, no waits.
