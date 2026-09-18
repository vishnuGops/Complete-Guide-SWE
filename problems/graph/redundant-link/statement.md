A network of `n` machines was built as a tree — every machine reachable from
every other, with no loops — and then one extra two-way link was added, which
closed exactly one loop.

The links are given in the order they were installed. Report the link whose
installation closed the loop; if several links are part of the loop, report the
one installed last.

## Input

- `n` — how many machines there are
- `links` — a list of `n` `[a, b]` pairs, in installation order

## Output

The link that closed the loop, as `[a, b]`, exactly as it appears in the input.

## Constraints

- `3 <= n <= 10^4`
- `links.length == n`
- `0 <= a, b < n`, `a != b`, and no link is repeated.
- Exactly one loop exists, and every machine is reachable from every other.

## Examples

### Example 1

Input: `n = 3`, `links = [[0, 1], [1, 2], [0, 2]]`

Output: `[0, 2]`

The first two links join everything; the third closes the loop.

### Example 2

Input: `n = 4`, `links = [[0, 1], [0, 2], [0, 3], [1, 2]]`

Output: `[1, 2]`

0, 1 and 2 are already joined when the last link arrives.

### Example 3

Input: `n = 3`, `links = [[0, 2], [0, 1], [1, 2]]`

Output: `[1, 2]`

## Notes

"Installed last" is not the same as "the last link in the list" — in Example 2
the last link happens to be the answer, but the rule is about which link finds
its two ends already joined.
