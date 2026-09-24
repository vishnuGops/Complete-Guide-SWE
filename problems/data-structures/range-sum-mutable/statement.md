A row of readings that can be changed, and asked for the total of any stretch.

## Operations

- `SumTable(readings)` — the row to start from
- `set(at, value)` — replace the reading at position `at` with `value`
- `total(from, to)` — the sum of the readings from `from` to `to`, both included

## Input

- Construction takes a list of integers.
- `set` takes two integers; `total` takes two.

## Output

- `set` returns nothing.
- `total` returns an integer.

## Constraints

- `1 <= readings.length <= 10^4`
- `-10^4 <= reading value <= 10^4`
- `0 <= at < readings.length`
- `0 <= from <= to < readings.length`
- At most 2 · 10^4 operations.

## Examples

### Example 1

`SumTable([1, 3, 5])`, `total(0, 2)` → `9`, `set(1, 2)`, `total(0, 2)` → `8`

### Example 2

`SumTable([5])`, `total(0, 0)` → `5`

### Example 3

`SumTable([1, 2, 3])`, `total(1, 1)` → `2`

A stretch of one reading is its own total.

## Notes

The two easy designs each make one operation `O(n)`: the plain row makes `total`
linear, and a table of running totals makes `set` linear. At the stated maxima
that is up to two hundred million steps, each of them a cheap addition, and it
finishes: the `O(log n)` per operation is the target, not something a timeout
enforces.
