`n` cities are numbered `0` to `n - 1`, and `distance[a][b]` is the cost of
travelling from `a` to `b`. The costs need not be the same in both directions.

Starting at city `0`, visit every other city exactly once and return to city `0`.
Report the smallest total cost.

## Input

- `distance` — an `n` by `n` grid of costs; `distance[i][i]` is `0`

## Output

The smallest total cost of such a round trip.

## Constraints

- `1 <= n <= 12`
- `0 <= distance[i][j] <= 1000`
- `distance[i][i] == 0`

## Examples

### Example 1

Input: `distance = [[0, 1, 15, 6], [2, 0, 7, 3], [9, 6, 0, 12], [10, 4, 8, 0]]`

Output: `21`

0 → 1 → 3 → 2 → 0 costs 1 + 3 + 8 + 9 = 21.

### Example 2

Input: `distance = [[0]]`

Output: `0`

One city: the trip is already over.

### Example 3

Input: `distance = [[0, 5], [7, 0]]`

Output: `12`

Out and back.

## Notes

Trying every order is `(n-1)!` — nearly forty million at `n = 12`, each costing
`n` additions. The table below is about six hundred thousand updates.
