`n` places are numbered `0` to `n - 1` and joined by **one-way** roads, each with
a positive toll.

Report the cheapest total toll from `start` to `finish`, or `-1` if no route
exists.

## Input

- `n` — how many places there are
- `roads` — a list of `[from, to, toll]` triples
- `start` — where you begin
- `finish` — where you want to get to

## Output

The cheapest total toll, or `-1`.

## Constraints

- `1 <= n <= 10^4`
- `0 <= roads.length <= 5 · 10^4`
- `0 <= from, to < n`, `from != to`, and no `[from, to]` pair is repeated.
- `1 <= toll <= 10^4`
- `0 <= start, finish < n`

## Examples

### Example 1

Input: `n = 4`, `roads = [[0, 1, 1], [1, 2, 1], [0, 2, 5], [2, 3, 1]]`,
`start = 0`, `finish = 3`

Output: `3`

0 → 1 → 2 → 3 costs 3; the direct road to 2 costs 5 on its own.

### Example 2

Input: `n = 2`, `roads = [[1, 0, 4]]`, `start = 0`, `finish = 1`

Output: `-1`

The only road runs the other way.

### Example 3

Input: `n = 1`, `roads = []`, `start = 0`, `finish = 0`

Output: `0`

You are already there and have paid nothing.

## Notes

Relaxing every road `n` times — the textbook algorithm that also handles negative
tolls — is `O(n · roads)`. At the stated maxima that is five hundred million
relaxations and it will not finish. Every toll here is positive, which is what
lets you do better.
