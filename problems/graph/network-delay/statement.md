`n` machines are numbered `0` to `n - 1`. A link `[from, to, delay]` means a
message sent from `from` reaches `to` after `delay` ticks. Links are one-way.

A message is broadcast from `source` at tick 0 and is passed on immediately by
every machine that receives it. Report the tick at which the **last** machine
hears it, or `-1` if some machine never does.

## Input

- `n` — how many machines there are
- `links` — a list of `[from, to, delay]` triples
- `source` — the machine that starts the broadcast

## Output

The tick at which every machine has heard the message, or `-1`.

## Constraints

- `1 <= n <= 10^4`
- `0 <= links.length <= 5 · 10^4`
- `0 <= from, to < n`, `from != to`, and no `[from, to]` pair is repeated.
- `1 <= delay <= 10^4`
- `0 <= source < n`

## Examples

### Example 1

Input: `n = 4`, `links = [[0, 1, 1], [0, 2, 4], [1, 2, 1], [2, 3, 1]]`,
`source = 0`

Output: `3`

1 hears at tick 1, 2 at tick 2 through 1 rather than at 4 directly, and 3 at
tick 3.

### Example 2

Input: `n = 2`, `links = []`, `source = 0`

Output: `-1`

Machine 1 never hears anything.

### Example 3

Input: `n = 1`, `links = []`, `source = 0`

Output: `0`

The only machine is the source, and it knows at once.

## Notes

This is `cheapest-route` asked of every machine at once rather than of one — the
same single run answers it, and the difference is only what you do with the
answers.
