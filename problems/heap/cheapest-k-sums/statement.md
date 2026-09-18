Two price lists are each sorted from cheapest to dearest, and all the prices
within a list are different. A *pairing* takes one price from each list and costs
their sum.

Report the `k` cheapest pairings, cheapest first. Two pairings that cost the same
are ordered by their price from the first list, and then by their price from the
second.

## Input

- `first` — a list of distinct integers, sorted ascending
- `second` — a list of distinct integers, sorted ascending
- `k` — how many pairings to report

## Output

A list of `k` pairs `[a, b]`, where `a` comes from `first` and `b` from
`second`, in the order described.

## Constraints

- `1 <= first.length <= 10^4`
- `1 <= second.length <= 10^4`
- `1 <= k <= min(10^4, first.length · second.length)`
- `-10^9 <= price <= 10^9`
- Each list is sorted ascending and has no repeated price.

## Examples

### Example 1

Input: `first = [1, 7, 11]`, `second = [2, 4, 6]`, `k = 3`

Output: `[[1, 2], [1, 4], [1, 6]]`

The three cheapest pairings all use the 1.

### Example 2

Input: `first = [1, 2]`, `second = [3]`, `k = 2`

Output: `[[1, 3], [2, 3]]`

### Example 3

Input: `first = [1, 2]`, `second = [1, 2]`, `k = 3`

Output: `[[1, 1], [1, 2], [2, 1]]`

`[1, 2]` and `[2, 1]` both cost 3, and the tie goes to the smaller first price.

## Notes

There are up to `10^8` pairings at the stated maxima. Building them all and
sorting will not finish — and it is not needed, because at most `k` of them are
ever candidates.
