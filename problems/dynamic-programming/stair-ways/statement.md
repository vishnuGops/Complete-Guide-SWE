A staircase has `n` steps. Each move goes up one step or two. Count the different
ways to reach the top.

Two ways are different when they take a different sequence of moves, so `1 + 2`
and `2 + 1` are two ways of climbing three steps.

## Input

- `n` — how many steps

## Output

The number of ways to reach the top.

## Constraints

- `0 <= n <= 45`

## Examples

### Example 1

Input: `n = 3`

Output: `3`

`1+1+1`, `1+2` and `2+1`.

### Example 2

Input: `n = 1`

Output: `1`

### Example 3

Input: `n = 0`

Output: `1`

There is one way to climb nothing: make no moves.
