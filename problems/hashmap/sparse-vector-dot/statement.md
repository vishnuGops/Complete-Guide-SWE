Sensor rows are long and mostly zero: ten thousand slots of which a handful
carry a reading. Storing every slot wastes room, and multiplying every slot
wastes time.

Build a store that keeps only the readings that are actually there, and can
multiply two rows together.

## Operations

- `SparseReadings()` — an empty store
- `add(name, values)` — store the row `values` under `name`, keeping only its
  non-zero entries. Adding a name that already exists replaces its row.
- `dot(first, second)` — the dot product of two stored rows: the sum over all
  positions of the product of the two entries. A name that was never added
  behaves as a row of zeroes, so its dot product is `0`.
- `nonZeroCount(name)` — how many entries are actually stored under `name`, or
  `0` for an unknown name.

Rows of different lengths are paired up position by position; a position present
in one row and past the end of the other contributes nothing.

## Input

- Construction takes no arguments.
- `add` takes a name and a list of integers; `dot` takes two names;
  `nonZeroCount` takes one name.

## Output

- `add` returns nothing.
- `dot` and `nonZeroCount` return an integer.

## Constraints

- `1 <= values.length <= 10^4`
- `-100 <= values[i] <= 100`
- At most 200 operations in total.

## Examples

### Example 1

`add("a", [1, 0, 0, 2, 3])`, `add("b", [0, 3, 0, 4, 0])`, `dot("a", "b")` → `8`

Only position 3 has a reading in both rows: 2 · 4 = 8.

### Example 2

`add("a", [0, 0, 0])`, `nonZeroCount("a")` → `0`

An all-zero row stores nothing at all.

### Example 3

`add("a", [5])`, `dot("a", "never-added")` → `0`

An unknown name is a row of zeroes.
