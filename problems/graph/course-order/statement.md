There are `n` courses numbered `0` to `n - 1`. A rule `[a, b]` means course `a`
must be taken before course `b`.

Report an order in which every course can be taken. If no such order exists,
report the empty list.

Several orders usually work. Report the **smallest by course number** — that is,
among all valid orders, the one that would come first in a dictionary: take the
lowest-numbered course that is available at each step.

## Input

- `n` — how many courses there are
- `rules` — a list of `[a, b]` pairs meaning `a` before `b`

## Output

A valid order of all `n` courses, smallest by course number, or `[]` if none
exists.

## Constraints

- `1 <= n <= 10^4`
- `0 <= rules.length <= 2 · 10^4`
- `0 <= a, b < n`, `a != b`, and no rule is repeated.

## Examples

### Example 1

Input: `n = 4`, `rules = [[0, 1], [0, 2], [1, 3], [2, 3]]`

Output: `[0, 1, 2, 3]`

Both `[0, 1, 2, 3]` and `[0, 2, 1, 3]` work; the first is smaller.

### Example 2

Input: `n = 2`, `rules = [[0, 1], [1, 0]]`

Output: `[]`

Each course must come before the other, which is impossible.

### Example 3

Input: `n = 3`, `rules = []`

Output: `[0, 1, 2]`

With no rules, the smallest order is simply ascending.

## Notes

Repeatedly scanning every course for one whose prerequisites are all done is
`O(n^2)`. At the stated maximum that is a hundred million checks: too slow for
the time limit in Python, though Java's JIT gets through it. Either way it misses
the target.
