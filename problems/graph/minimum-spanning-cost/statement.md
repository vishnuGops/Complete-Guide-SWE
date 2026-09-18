`n` machines are numbered `0` to `n - 1`. Each possible cable is listed with its
price. Cables are two-way.

Buy a set of cables so that every machine can reach every other, for the smallest
total price. Report that price, or `-1` if no set of the offered cables connects
them all.

## Input

- `n` — how many machines there are
- `cables` — a list of `[a, b, price]` triples

## Output

The smallest total price that connects every machine, or `-1`.

## Constraints

- `1 <= n <= 10^4`
- `0 <= cables.length <= 10^5`
- `0 <= a, b < n`, `a != b`; the same pair may be offered more than once at
  different prices.
- `1 <= price <= 10^4`

## Examples

### Example 1

Input: `n = 3`, `cables = [[0, 1, 1], [1, 2, 2], [0, 2, 3]]`

Output: `3`

Buy the two cheapest; the third would only close a loop.

### Example 2

Input: `n = 3`, `cables = [[0, 1, 1]]`

Output: `-1`

Machine 2 cannot be reached.

### Example 3

Input: `n = 1`, `cables = []`

Output: `0`

One machine is already connected to everything it needs to be.

## Notes

`n - 1` cables are always enough and always necessary, so the question is only
*which* `n - 1`.
