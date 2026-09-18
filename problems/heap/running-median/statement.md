Readings arrive one at a time. After each one, report the median of everything
seen so far.

The median of an odd number of readings is the middle one once they are sorted;
for an even number it is the average of the two middle ones.

Nothing ever leaves — this is the whole stream, not a window.

## Operations

- `MedianStream()` — an empty stream
- `add(value)` — record a reading and return the median of everything so far

## Input

- Construction takes no arguments.
- `add` takes an integer.

## Output

- `add` returns a number. Answers within `10^-6` are accepted.

## Constraints

- At most 10^4 calls to `add`.
- `-10^9 <= value <= 10^9`

## Examples

### Example 1

`add(1)` → `1`, `add(2)` → `1.5`, `add(3)` → `2`

After two readings the median is the average of both.

### Example 2

`add(5)` → `5`, `add(5)` → `5`

Duplicates are ordinary readings.

### Example 3

`add(-10^9)` → `-1000000000`, `add(10^9)` → `0`

The two extremes average to zero — a sum that does not fit in a 32-bit integer.
