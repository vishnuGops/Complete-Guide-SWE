A row of readings that can be changed, and asked for the smallest reading in any
stretch.

## Operations

- `MinTable(readings)` — the row to start from
- `set(at, value)` — replace the reading at position `at` with `value`
- `smallest(from, to)` — the smallest reading from `from` to `to`, both included

## Input

- Construction takes a list of integers.
- `set` takes two integers; `smallest` takes two.

## Output

- `set` returns nothing.
- `smallest` returns an integer.

## Constraints

- `1 <= readings.length <= 10^4`
- `-10^9 <= reading value <= 10^9`
- `0 <= at < readings.length`
- `0 <= from <= to < readings.length`
- At most 2 · 10^4 operations.

## Examples

### Example 1

`MinTable([1, 3, 5, 2])`, `smallest(0, 3)` → `1`, `set(0, 9)`,
`smallest(0, 3)` → `2`

### Example 2

`MinTable([5])`, `smallest(0, 0)` → `5`

### Example 3

`MinTable([4, 4, 4])`, `smallest(1, 2)` → `4`

## Notes

Minimum has no inverse — you cannot subtract one range's minimum from another's,
the way `range-sum-mutable` subtracts prefix sums. That is exactly why this needs
a different structure.

Scanning the stretch on every query is `O(n)` per query, and at these sizes it
finishes; the `O(log n)` per operation is the target, not something a timeout
enforces.
