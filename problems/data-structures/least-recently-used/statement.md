A cache that holds at most `capacity` entries. When it is full and a new key
arrives, the **least recently used** entry is thrown out.

Reading a key counts as using it, and so does writing one.

## Operations

- `RecentCache(capacity)` — an empty cache
- `get(key)` — the value stored under `key`, or `-1` if it is not there
- `put(key, value)` — store `value` under `key`, evicting if necessary

## Input

- Construction takes an integer.
- `get` takes an integer; `put` takes two.

## Output

- `get` returns an integer.
- `put` returns nothing.

## Constraints

- `1 <= capacity <= 3000`
- `0 <= key, value <= 10^5`
- At most 2 · 10^4 operations.

## Examples

### Example 1

`RecentCache(2)`, `put(1,1)`, `put(2,2)`, `get(1)` → `1`, `put(3,3)`,
`get(2)` → `-1`, `get(3)` → `3`

Reading key 1 made it the most recent, so key 2 was the one thrown out.

### Example 2

`RecentCache(1)`, `put(1,1)`, `put(2,2)`, `get(1)` → `-1`

### Example 3

`RecentCache(2)`, `put(1,1)`, `put(1,5)`, `get(1)` → `5`

Writing an existing key replaces its value and does not use up a second slot.

## Notes

Every operation must be `O(1)`. Scanning for the least recently used entry is
`O(capacity)`, which at the stated maxima is sixty million steps.
