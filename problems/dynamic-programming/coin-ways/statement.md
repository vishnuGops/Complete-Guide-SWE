You have an unlimited supply of each coin. Count the ways to make exactly
`amount`.

Two ways are the same when they use the same coins the same number of times —
order does not matter, so `1 + 2` and `2 + 1` are one way.

## Input

- `coins` — the coin values available, all different
- `amount` — the total to make

## Output

The number of ways to make the amount.

## Constraints

- `1 <= coins.length <= 20`
- `1 <= coins[i] <= 1000`
- `0 <= amount <= 1000`
- All coin values are different.
- The answer fits in a signed 32-bit integer.

## Examples

### Example 1

Input: `coins = [1, 2, 5]`, `amount = 5`

Output: `4`

`5`, `2+2+1`, `2+1+1+1` and `1+1+1+1+1`.

### Example 2

Input: `coins = [2]`, `amount = 3`

Output: `0`

### Example 3

Input: `coins = [1]`, `amount = 0`

Output: `1`

One way to make nothing: take no coins.

## Notes

Enumerating the ways and counting them is what `sum-combinations` does, and there
can be astronomically many. This question asks only *how many*, which a table
answers without ever writing one down.
