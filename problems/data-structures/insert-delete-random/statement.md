A set of integers where adding, removing **and picking a member at random** all
take constant time.

## Operations

- `RandomSet()` — an empty set
- `add(value)` — put `value` in; returns `true` if it was not already there
- `remove(value)` — take `value` out; returns `true` if it was there
- `pick()` — return **any** value currently in the set

`pick` is only called when the set is not empty. Any member may be returned — a
real implementation would choose uniformly at random, and any choice is accepted
here.

## Input

- Construction takes no arguments.
- `add`, `remove` and `pick` take an integer, an integer and nothing.

## Output

- `add` and `remove` return a boolean.
- `pick` returns an integer.

## Constraints

- `-10^9 <= value <= 10^9`
- At most 2 · 10^4 operations.
- `pick` is never called on an empty set.

## Examples

### Example 1

`add(1)` → `true`, `remove(2)` → `false`, `add(2)` → `true`, `pick()` → `1` or
`2`, `remove(1)` → `true`, `pick()` → `2`

### Example 2

`add(1)` → `true`, `add(1)` → `false`

The second add finds it already there.

### Example 3

`add(5)` → `true`, `remove(5)` → `true`, `remove(5)` → `false`
