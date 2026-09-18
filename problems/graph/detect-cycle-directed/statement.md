`n` places are numbered `0` to `n - 1`, joined by **one-way** roads.

Report whether some place can be left and returned to by following the roads
forwards. A road from a place to itself counts.

## Input

- `n` — how many places there are
- `roads` — a list of `[from, to]` pairs, each a one-way road

## Output

`true` if a loop exists, `false` otherwise.

## Constraints

- `1 <= n <= 10^4`
- `0 <= roads.length <= 2 · 10^4`
- `0 <= from, to < n`, and no road is repeated. A road may lead from a place to
  itself.

## Examples

### Example 1

Input: `n = 3`, `roads = [[0, 1], [1, 2], [2, 0]]`

Output: `true`

### Example 2

Input: `n = 3`, `roads = [[0, 1], [0, 2], [1, 2]]`

Output: `false`

Two ways to reach 2, and no way back.

### Example 3

Input: `n = 1`, `roads = [[0, 0]]`

Output: `true`

A road to itself is a loop of one.

## Notes

Example 2 is the case a plain "have I been here before" check gets wrong:
reaching 2 twice by different routes is not a loop.
