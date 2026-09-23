`n` machines are numbered `0` to `n - 1` and start with no connections at all.
Connections arrive one at a time, and questions about them are asked in between.

## Operations

- `Connections(n)` — `n` machines, nothing connected
- `link(a, b)` — connect `a` and `b`; returns `true` if this joined two
  previously separate groups, `false` if they were already in the same one
- `joined(a, b)` — whether `a` and `b` are in the same group
- `groups()` — how many separate groups there are
- `sizeOf(a)` — how many machines are in `a`'s group

## Input

- Construction takes an integer `n`.
- `link` and `joined` take two integers; `groups` takes none; `sizeOf` takes one.

## Output

- `link` and `joined` return a boolean; `groups` and `sizeOf` return an integer.

## Constraints

- `1 <= n <= 10^4`
- At most 2 · 10^4 operations.
- Every machine number is in `0 .. n - 1`; `link` and `joined` may be given the
  same machine twice.

## Examples

### Example 1

`Connections(4)`, `link(0, 1)` → `true`, `link(1, 2)` → `true`, `joined(0, 2)` →
`true`, `groups()` → `2`

`{0, 1, 2}` and `{3}`.

### Example 2

`Connections(3)`, `link(0, 1)` → `true`, `link(1, 0)` → `false`

The second connection joins nothing new.

### Example 3

`Connections(2)`, `sizeOf(0)` → `1`, `link(0, 1)` → `true`, `sizeOf(0)` → `2`

## Notes

The questions are asked _between_ the connections, which is the whole point: a
traversal answers each one in `O(n)` and there is no traversal here at all.
