Build a queue — first in, first out — using only the operations a stack gives
you: push onto the end, pop from the end, look at the end, and ask whether it is
empty.

Every operation must be **amortised** `O(1)`. A single call may do more work
than that, but any run of `n` calls must cost `O(n)` in total.

## Operations

- `StackQueue()` — an empty queue
- `push(value)` — add a value to the back
- `pop()` — remove and return the value at the front, or `-1` if the queue is
  empty
- `peek()` — return the value at the front without removing it, or `-1` if the
  queue is empty
- `empty()` — whether the queue holds nothing

## Input

- Construction takes no arguments.
- `push` takes an integer; `pop`, `peek` and `empty` take none.

## Output

- `push` returns nothing.
- `pop` and `peek` return an integer, `empty` a boolean.

## Constraints

- `-10^9 <= value <= 10^9`
- At most 2000 operations in total.

## Examples

### Example 1

`push(1)`, `push(2)`, `peek()` → `1`, `pop()` → `1`, `empty()` → `false`

The first value in is the first out, even though a stack would give back the 2.

### Example 2

`pop()` → `-1`, `empty()` → `true`

An empty queue reports `-1` rather than failing.

### Example 3

`push(5)`, `pop()` → `5`, `push(6)`, `pop()` → `6`

Pushing after emptying the queue works as it should.
