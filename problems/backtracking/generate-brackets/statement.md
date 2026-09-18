Report every balanced string made of exactly `n` opening brackets and `n` closing
ones, **nested no more than `depth` deep**.

A string is balanced when, reading left to right, the number of closing brackets
never exceeds the number of opening ones and the two totals are equal at the end.
Its nesting depth is the most brackets open at any moment: `"(())"` is two deep
and `"()()"` is one.

The strings may be reported in any order.

## Input

- `n` — how many pairs of brackets
- `depth` — the most that may be open at once

## Output

Every balanced string of `n` pairs nested at most `depth` deep, as a list of
strings.

## Constraints

- `0 <= n <= 8`
- `0 <= depth <= n`

## Examples

### Example 1

Input: `n = 3`, `depth = 3`

Output: `["((()))","(()())","(())()","()(())","()()()"]`

Every balanced string of three pairs; none is more than three deep.

### Example 2

Input: `n = 3`, `depth = 1`

Output: `["()()()"]`

Nothing may be open when a new bracket opens, so the pairs cannot nest at all.

### Example 3

Input: `n = 0`, `depth = 0`

Output: `[""]`

One string, the empty one — there is exactly one way to write no brackets.
