A meter reports a signed value every minute — positive when it gained, negative
when it lost. Given the values in order, find the largest total any unbroken run
of minutes adds up to.

A run must contain at least one minute, so the answer is never empty even when
every value is negative.

## Input

- `values` — a list of integers, in time order

## Output

The largest sum over every contiguous, non-empty slice of `values`.

## Constraints

- `1 <= values.length <= 10^4`
- `-10^4 <= values[i] <= 10^4`

## Examples

### Example 1

Input: `values = [3, -4, 2, 5, -1, 4, -6, 1]`

Output: `10`

The run `[2, 5, -1, 4]` adds up to 10, and nothing else beats it. Carrying the
opening 3 across the -4 would only cost 1.

### Example 2

Input: `values = [-3, -1, -7]`

Output: `-1`

Every value is a loss, so the best run is the single least bad minute.

### Example 3

Input: `values = [2, 3, 4]`

Output: `9`

Nothing is negative, so the whole row is the answer.
