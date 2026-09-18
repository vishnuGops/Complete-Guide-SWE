A cache that holds at most `capacity` entries. When it is full and a new key
arrives, the **least frequently used** entry is thrown out; if several are tied
for least used, the one among them that was used longest ago goes.

Every `get` and every `put` of a key counts as one use of it.

## Operations

- `PopularCache(capacity)` — an empty cache
- `get(key)` — the value stored under `key`, or `-1` if it is not there
- `put(key, value)` — store `value` under `key`, evicting if necessary

## Input

- Construction takes an integer.
- `get` takes an integer; `put` takes two.

## Output

- `get` returns an integer.
- `put` returns nothing.

## Constraints

- `1 <= capacity <= 2000`
- `0 <= key, value <= 10^5`
- At most 2 · 10^4 operations.

## Examples

### Example 1

`PopularCache(2)`, `put(1,1)`, `put(2,2)`, `get(1)` → `1`, `put(3,3)`,
`get(2)` → `-1`, `get(3)` → `3`

Key 1 has been used twice and key 2 once, so key 2 is evicted.

### Example 2

`PopularCache(2)`, `put(1,1)`, `put(2,2)`, `put(3,3)`, `get(1)` → `-1`

Both keys have been used once, so the tie is broken by age and key 1 goes.

### Example 3

`PopularCache(1)`, `put(1,1)`, `get(1)` → `1`, `put(2,2)`, `get(1)` → `-1`

## Notes

A cache of zero capacity is not asked for. Every operation must be `O(1)` — a
scan for the least used entry is `O(capacity)`, which the maxima rule out.
