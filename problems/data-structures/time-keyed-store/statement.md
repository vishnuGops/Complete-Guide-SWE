A store remembers every value a key has ever held, together with when it was set,
and can be asked what a key held at any moment.

Each key's values are set at strictly increasing times.

## Operations

- `TimeStore()` — an empty store
- `set(key, value, at)` — record that `key` held `value` from time `at`
- `get(key, at)` — the value `key` held at time `at`: the one set at the largest
  time not after `at`. If the key had no value by then, the empty string.

## Input

- Construction takes no arguments.
- `set` takes two strings and an integer; `get` takes a string and an integer.

## Output

- `set` returns nothing.
- `get` returns a string.

## Constraints

- `1 <= key length, value length <= 20`
- `1 <= at <= 10^7`
- Keys and values are lowercase letters and digits.
- For each key, the times passed to `set` strictly increase.
- At most 10^4 operations.

## Examples

### Example 1

`set("a", "one", 1)`, `get("a", 1)` → `"one"`, `get("a", 3)` → `"one"`,
`set("a", "two", 4)`, `get("a", 4)` → `"two"`, `get("a", 5)` → `"two"`

### Example 2

`get("missing", 1)` → `""`

### Example 3

`set("a", "one", 10)`, `get("a", 5)` → `""`

The key had no value yet at time 5.
