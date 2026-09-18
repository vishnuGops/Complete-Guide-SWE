A sensor reports a reading every minute, and you are given the readings in
the order they arrived. For each minute, report the highest reading seen up to
and including that minute.

The answer therefore never decreases: once a high reading has been seen, no
later minute can report anything lower.

## Input

- `readings` — a list of integers, in arrival order

## Output

A list of the same length. Position `i` holds the largest value among
`readings[0..i]`.

## Constraints

- `1 <= readings.length <= 10^4`
- `-10^9 <= readings[i] <= 10^9`

## Examples

### Example 1

Input: `readings = [3, 1, 4, 1, 5]`

Output: `[3, 3, 4, 4, 5]`

The first minute has only itself to compare with. The second reading is lower
than the first, so the highest so far is still 3. The third raises it to 4, and
the fifth to 5.

### Example 2

Input: `readings = [7]`

Output: `[7]`

One reading is its own maximum.

### Example 3

Input: `readings = [-2, -5, -1, -9]`

Output: `[-2, -2, -1, -1]`

Negative values behave no differently: the answer tracks the largest, which here
is the least negative seen so far.
