`n` people are numbered `0` to `n - 1`, and each link joins two of them. Links go
both ways, and being linked is contagious: if A is linked to B and B to C, all
three are in the same group.

Count the groups. Somebody with no links at all is a group of one.

## Input

- `n` — how many people there are
- `links` — a list of `[a, b]` pairs

## Output

The number of groups.

## Constraints

- `1 <= n <= 10^4`
- `0 <= links.length <= 2 · 10^4`
- `0 <= a, b < n`, `a != b`, and no pair is repeated.

## Examples

### Example 1

Input: `n = 5`, `links = [[0, 1], [1, 2], [3, 4]]`

Output: `2`

`{0, 1, 2}` and `{3, 4}`.

### Example 2

Input: `n = 5`, `links = [[0, 1], [1, 2], [2, 3], [3, 4]]`

Output: `1`

### Example 3

Input: `n = 3`, `links = []`

Output: `3`

Nobody is linked, so everybody is their own group.
