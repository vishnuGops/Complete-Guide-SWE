Design a stack of integers that can also report the smallest value it currently
holds, without searching for it.

Implement a class `MinValueStack` supporting four operations:

- `push(value)` — put `value` on top of the stack. Returns nothing.
- `pop()` — remove the top value and return it.
- `top()` — return the top value without removing it.
- `smallest()` — return the smallest value anywhere in the stack.

Every operation must run in `O(1)` time. `smallest()` in particular may not walk
the stack.

## Input

A sequence of calls, applied in order to one freshly constructed
`MinValueStack`. The constructor takes no arguments.

## Output

The value returned by each call, in order. `push` returns nothing, which the
judge records as `null`.

## Constraints

- At most `10^4` calls in total.
- `-10^9 <= value <= 10^9`
- `pop`, `top` and `smallest` are never called on an empty stack.
- Every operation must run in `O(1)` time.

## Examples

### Example 1

Calls: `push(3)`, `push(1)`, `smallest()`, `pop()`, `smallest()`
Returns: `[null, null, 1, 1, 3]`

After both pushes the stack is `[3, 1]` with `1` on top, so `smallest()` is `1`.
`pop()` removes and returns that `1`, leaving `[3]` — and the smallest value is
now `3` again.

### Example 2

Calls: `push(5)`, `push(5)`, `pop()`, `smallest()`
Returns: `[null, null, 5, 5]`

Two equal values are two separate elements. Removing one of them leaves the other
behind, so `5` is still in the stack and still the smallest.

### Example 3

Calls: `push(-2)`, `push(7)`, `top()`, `smallest()`
Returns: `[null, null, 7, -2]`

`top()` reports the most recently pushed value, `smallest()` the smallest one
anywhere. They have no reason to agree.
